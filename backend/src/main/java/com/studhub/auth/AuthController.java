package com.studhub.auth;

import com.studhub.user.User;
import com.studhub.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final PasswordEncoder passwordEncoder;
    private final SecurityContextRepository securityContextRepository;
    private final CppUserClient cppUserClient;
    private final MailService mailService;
    private final EmailVerificationTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final long verificationTtlHours;
    private final String frontendUrl;
    private final String bypassCode;

    public AuthController(PasswordEncoder passwordEncoder, SecurityContextRepository securityContextRepository,
                          CppUserClient cppUserClient, MailService mailService,
                          EmailVerificationTokenRepository tokenRepository, UserRepository userRepository,
                          @Value("${app.mail.verification-ttl-hours:24}") long verificationTtlHours,
                          @Value("${frontend.url:http://localhost:5173}") String frontendUrl,
                          @Value("${app.register.bypass-code:}") String bypassCode) { // Пустой дефолт для безопасности
        this.passwordEncoder = passwordEncoder;
        this.securityContextRepository = securityContextRepository;
        this.cppUserClient = cppUserClient;
        this.mailService = mailService;
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.verificationTtlHours = verificationTtlHours;
        this.frontendUrl = frontendUrl;
        this.bypassCode = bypassCode;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body, HttpServletRequest request, HttpServletResponse response) {
        String identifier = body.getOrDefault("email", "").trim().toLowerCase();
        String password = body.getOrDefault("password", "");

        if (identifier.isEmpty() || password.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "Введите email/логин и пароль"));

        User user = userRepository.findByEmail(identifier).or(() -> userRepository.findByLogin(identifier)).orElse(null);

        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Неверный email/логин или пароль"));
        }

        authenticate(user, request, response);
        return ResponseEntity.ok(buildProfile(user));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest body, HttpServletRequest request, HttpServletResponse response) {
        String email = body.getEmail().trim().toLowerCase();
        String login = body.getLogin().trim();
        String code = body.getCode() == null ? "" : body.getCode().trim();
        boolean bypassVerification = !bypassCode.isEmpty() && bypassCode.equals(code);

        if (userRepository.existsByEmail(email) || userRepository.existsByLogin(login)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Пользователь уже существует"));
        }

        // Сохраняем напрямую в Java БД, чтобы избежать рассинхрона кэша Hibernate и C++
        User newUser = new User();
        newUser.setEmail(email);
        newUser.setLogin(login);
        newUser.setPasswordHash(passwordEncoder.encode(body.getPassword()));
        newUser.setFirstName(body.getFirstName().trim());
        newUser.setLastName(body.getLastName().trim());
        newUser.setGroupName(body.getGroup().trim());
        newUser.setRole(bypassVerification ? "ADMIN" : "STUDENT");
        
        userRepository.save(newUser);

        // Уведомляем C++ сервис (если ему нужны эти данные для своей логики)
        Map<String, String> payload = Map.of(
            "user_id", String.valueOf(newUser.getId()),
            "email", email, "login", login, "role", newUser.getRole()
        );
        cppUserClient.syncOAuth(payload); // Используем sync как апдейт

        Map<String, Object> responseBody = buildProfile(newUser);

        if (bypassVerification) {
            authenticate(newUser, request, response);
            responseBody.put("verificationSent", false);
            responseBody.put("verified", true);
            return ResponseEntity.status(HttpStatus.CREATED).body(responseBody);
        }

        EmailVerificationToken vt = new EmailVerificationToken();
        vt.setToken(UUID.randomUUID().toString().replace("-", ""));
        vt.setEmail(email);
        vt.setLogin(login);
        vt.setExpiresAt(Instant.now().plus(verificationTtlHours, ChronoUnit.HOURS));
        tokenRepository.save(vt);

        try {
            mailService.sendVerification(email, login, vt.getToken());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "Не удалось отправить письмо"));
        }

        responseBody.put("verificationSent", true);
        return ResponseEntity.status(HttpStatus.CREATED).body(responseBody);
    }

    @GetMapping("/confirm")
    public ResponseEntity<Void> confirm(@RequestParam("token") String token, HttpServletRequest request, HttpServletResponse response) {
        EmailVerificationToken vt = tokenRepository.findByToken(token).orElse(null);
        if (vt == null) return redirect(frontendUrl + "/login?verify=invalid");
        if (vt.isUsed()) return redirect(frontendUrl + "/login?verify=used");
        if (vt.isExpired()) return redirect(frontendUrl + "/login?verify=expired");

        vt.setUsedAt(Instant.now());
        tokenRepository.save(vt);

        User user = userRepository.findByEmail(vt.getEmail()).orElse(null);
        if (user != null) authenticate(user, request, response);
        
        return redirect(frontendUrl + "/?verified=1");
    }

    private Map<String, Object> buildProfile(User user) {
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", user.getId());
        profile.put("email", user.getEmail());
        profile.put("login", user.getLogin());
        profile.put("firstName", user.getFirstName());
        profile.put("lastName", user.getLastName());
        profile.put("role", user.getRole());
        return profile;
    }

    private static ResponseEntity<Void> redirect(String url) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }

    private void authenticate(User user, HttpServletRequest request, HttpServletResponse response) {
        List<GrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().toUpperCase()));
        Authentication auth = new UsernamePasswordAuthenticationToken(user.getEmail(), null, authorities);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }
}