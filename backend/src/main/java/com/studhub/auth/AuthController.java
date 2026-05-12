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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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

    public AuthController(PasswordEncoder passwordEncoder,
                          SecurityContextRepository securityContextRepository,
                          CppUserClient cppUserClient,
                          MailService mailService,
                          EmailVerificationTokenRepository tokenRepository,
                          UserRepository userRepository,
                          @Value("${app.mail.verification-ttl-hours:24}") long verificationTtlHours,
                          @Value("${frontend.url:http://localhost:5173}") String frontendUrl,
                          @Value("${app.register.bypass-code:admin}") String bypassCode) {
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
    public ResponseEntity<?> login(@RequestBody Map<String, String> body,
                                   HttpServletRequest request,
                                   HttpServletResponse response) {
        String identifier = body.getOrDefault("email", "").trim().toLowerCase();
        String password = body.getOrDefault("password", "");

        if (identifier.isEmpty() || password.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Введите email/логин и пароль"));
        }

        User user = userRepository.findByEmail(identifier)
                .or(() -> userRepository.findByLogin(identifier))
                .orElse(null);

        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Неверный email/логин или пароль"));
        }

        authenticate(user, request, response);

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", user.getId());
        profile.put("email", user.getEmail());
        profile.put("login", user.getLogin());
        profile.put("firstName", user.getFirstName());
        profile.put("lastName", user.getLastName());
        return ResponseEntity.ok(profile);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest body,
                                      HttpServletRequest request,
                                      HttpServletResponse response) {
        String email = body.getEmail().trim().toLowerCase();
        String login = body.getLogin().trim();
        String code = body.getCode() == null ? "" : body.getCode().trim();
        boolean bypassVerification = !bypassCode.isEmpty() && bypassCode.equals(code);

        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("email", email);
        payload.put("login", login);
        payload.put("password_hash", passwordEncoder.encode(body.getPassword()));
        payload.put("first_name", body.getFirstName().trim());
        payload.put("last_name", body.getLastName().trim());
        payload.put("group_name", body.getGroup().trim());

        CppUserClient.Result result = cppUserClient.register(payload);
        if (!result.isSuccess()) {
            return ResponseEntity.status(result.status()).body(result.body());
        }

        Long userId = null;
        try {
            if (result.body() instanceof Map) {
                Map<String, Object> cppResponse = (Map<String, Object>) result.body();
                userId = ((Number) cppResponse.get("id")).longValue();
            }
        } catch (Exception e) {
            log.warn("Failed to extract user id from C++ response", e);
        }

        Map<String, Object> responseBody = new LinkedHashMap<>();
        responseBody.put("id", userId);
        responseBody.put("email", email);
        responseBody.put("login", login);

        if (bypassVerification) {
            log.info("Registration bypass code used for {}", email);
            User newUser = userRepository.findByEmail(email).orElse(null);
            if (newUser != null) {
                authenticate(newUser, request, response);
            } else {
                // fallback: если вдруг ещё не появился – логиним с ролью user (маловероятно)
                authenticate(email, List.of(new SimpleGrantedAuthority("ROLE_USER")), request, response);
            }
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
            log.error("Failed to send verification email to {}", email, e);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Не удалось отправить письмо подтверждения"));
        }

        responseBody.put("verificationSent", true);
        return ResponseEntity.status(HttpStatus.CREATED).body(responseBody);
    }

    @GetMapping("/confirm")
    public ResponseEntity<Void> confirm(@RequestParam("token") String token,
                                        HttpServletRequest request,
                                        HttpServletResponse response) {
        EmailVerificationToken vt = tokenRepository.findByToken(token).orElse(null);
        if (vt == null) {
            return redirect(frontendUrl + "/login?verify=invalid");
        }
        if (vt.isUsed()) {
            return redirect(frontendUrl + "/login?verify=used");
        }
        if (vt.isExpired()) {
            return redirect(frontendUrl + "/login?verify=expired");
        }

        vt.setUsedAt(Instant.now());
        tokenRepository.save(vt);

        // Достаём пользователя из БД, чтобы получить актуальную роль
        User user = userRepository.findByEmail(vt.getEmail()).orElse(null);
        if (user != null) {
            authenticate(user, request, response);
        } else {
            // fallback: роль по умолчанию
            authenticate(vt.getEmail(), List.of(new SimpleGrantedAuthority("ROLE_USER")), request, response);
        }

        return redirect(frontendUrl + "/?verified=1");
    }

    private static ResponseEntity<Void> redirect(String url) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }

    // Аутентификация с передачей пользователя (основной метод)
    private void authenticate(User user, HttpServletRequest request, HttpServletResponse response) {
        List<GrantedAuthority> authorities = List.of(
                new SimpleGrantedAuthority("ROLE_" + user.getRole().toUpperCase())
        );
        authenticate(user.getEmail(), authorities, request, response);
    }

    // Вспомогательный метод, используется в исключительных случаях
    private void authenticate(String principal, List<GrantedAuthority> authorities,
                              HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                authorities
        );
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);

        securityContextRepository.saveContext(context, request, response);

        HttpSession session = request.getSession(true);
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
    }
}