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

    public AuthController(PasswordEncoder passwordEncoder,
                          SecurityContextRepository securityContextRepository,
                          CppUserClient cppUserClient,
                          MailService mailService,
                          EmailVerificationTokenRepository tokenRepository,
                          UserRepository userRepository,
                          @Value("${app.mail.verification-ttl-hours:24}") long verificationTtlHours,
                          @Value("${frontend.url:http://localhost:5173}") String frontendUrl) {
        this.passwordEncoder = passwordEncoder;
        this.securityContextRepository = securityContextRepository;
        this.cppUserClient = cppUserClient;
        this.mailService = mailService;
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.verificationTtlHours = verificationTtlHours;
        this.frontendUrl = frontendUrl;
    }

    /**
     * Вход по email/логину и паролю. Поле {@code email} принимает либо email,
     * либо login — это удобнее для пользователя (форма на фронте одна и та же).
     * При успехе создаётся HTTP-сессия — фронту достаточно слать запросы с
     * {@code credentials: 'include'}, кука {@code JSESSIONID} попадёт автоматически.
     */
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

        // Сначала пытаемся как email, потом — как login (форма принимает оба).
        User user = userRepository.findByEmail(identifier)
                .or(() -> userRepository.findByLogin(body.getOrDefault("email", "").trim()))
                .orElse(null);

        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            // Намеренно не уточняем, что именно неверно — чтобы не давать подсказки злоумышленнику.
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Неверный email/логин или пароль"));
        }

        authenticate(user.getEmail(), request, response);

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("email", user.getEmail());
        profile.put("login", user.getLogin());
        profile.put("firstName", user.getFirstName());
        profile.put("lastName", user.getLastName());
        return ResponseEntity.ok(profile);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest body) {
        String email = body.getEmail().trim().toLowerCase();
        String login = body.getLogin().trim();

        // Подготавливаем данные для C++ сервиса. Хешируем пароль здесь, чтобы
        // в C++ и в БД попадал уже готовый bcrypt-хэш.
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("email", email);
        payload.put("login", login);
        payload.put("password_hash", passwordEncoder.encode(body.getPassword()));
        payload.put("first_name", body.getFirstName().trim());
        payload.put("last_name", body.getLastName().trim());
        payload.put("group_name", body.getGroup().trim());

        // Запись в БД делает C++ сервис — Java сама в БД ничего не пишет.
        CppUserClient.Result result = cppUserClient.register(payload);
        if (!result.isSuccess()) {
            return ResponseEntity.status(result.status()).body(result.body());
        }

        // Генерим одноразовый токен для подтверждения почты.
        EmailVerificationToken vt = new EmailVerificationToken();
        vt.setToken(UUID.randomUUID().toString().replace("-", ""));
        vt.setEmail(email);
        vt.setLogin(login);
        vt.setExpiresAt(Instant.now().plus(verificationTtlHours, ChronoUnit.HOURS));
        tokenRepository.save(vt);

        // Отправляем письмо. Если SMTP недоступен — возвращаем 502, чтобы
        // фронт показал внятную ошибку, но пользователь в C++ уже создан.
        try {
            mailService.sendVerification(email, login, vt.getToken());
        } catch (Exception e) {
            log.error("Failed to send verification email to {}", email, e);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "Не удалось отправить письмо подтверждения"));
        }

        Map<String, Object> responseBody = new LinkedHashMap<>();
        responseBody.put("email", email);
        responseBody.put("login", login);
        responseBody.put("verificationSent", true);
        return ResponseEntity.status(HttpStatus.CREATED).body(responseBody);
    }

    /**
     * Пользователь кликает по ссылке из письма. Помечаем токен использованным,
     * создаём HTTP-сессию (логиним) и редиректим на главную страницу фронта.
     */
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

        authenticate(vt.getEmail(), request, response);

        // Главная страница приложения
        return redirect(frontendUrl + "/?verified=1");
    }

    private static ResponseEntity<Void> redirect(String url) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }

    private void authenticate(String principal, HttpServletRequest request, HttpServletResponse response) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(auth);
        SecurityContextHolder.setContext(context);

        securityContextRepository.saveContext(context, request, response);

        HttpSession session = request.getSession(true);
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
    }
}
