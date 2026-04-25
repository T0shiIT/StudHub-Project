package com.studhub.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final PasswordEncoder passwordEncoder;
    private final SecurityContextRepository securityContextRepository;
    private final CppUserClient cppUserClient;

    public AuthController(PasswordEncoder passwordEncoder,
                          SecurityContextRepository securityContextRepository,
                          CppUserClient cppUserClient) {
        this.passwordEncoder = passwordEncoder;
        this.securityContextRepository = securityContextRepository;
        this.cppUserClient = cppUserClient;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest body,
                                      HttpServletRequest request,
                                      HttpServletResponse response) {
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
            // Пробрасываем ошибку (например, 409 для конфликтов) клиенту.
            return ResponseEntity.status(result.status()).body(result.body());
        }

        // После успешной регистрации создаём HTTP-сессию и пускаем пользователя в систему.
        authenticate(email, request, response);

        Map<String, Object> responseBody = new LinkedHashMap<>();
        responseBody.put("email", email);
        responseBody.put("login", login);
        responseBody.put("firstName", payload.get("first_name"));
        responseBody.put("lastName", payload.get("last_name"));
        responseBody.put("group", payload.get("group_name"));
        Object cppId = result.body() != null ? result.body().get("id") : null;
        if (cppId != null) {
            responseBody.put("id", cppId);
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(responseBody);
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
