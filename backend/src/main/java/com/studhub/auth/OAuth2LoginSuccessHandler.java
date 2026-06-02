package com.studhub.auth;

import com.studhub.user.User;
import com.studhub.user.UserRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;


@Component
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuth2LoginSuccessHandler.class);
    private static final String DEFAULT_EMAIL_ATTRIBUTE = "default_email";
    private static final String EMAIL_ATTRIBUTE = "email";
    private static final String LOGIN_ATTRIBUTE = "login";
    private static final String REAL_NAME_ATTRIBUTE = "real_name";
    private static final String FIRST_NAME_ATTRIBUTE = "first_name";
    private static final String LAST_NAME_ATTRIBUTE = "last_name";
    private static final String DEFAULT_ROLE = "STUDENT";
    private static final String OAUTH_PASSWORD_HASH = "oauth:external";
    private static final String DEFAULT_GROUP_NAME = "—";

    private final CppUserClient cppUserClient;
    private final UserRepository userRepository;
    private final SecurityContextRepository securityContextRepository;

    public OAuth2LoginSuccessHandler(CppUserClient cppUserClient, UserRepository userRepository,
                                     SecurityContextRepository securityContextRepository,
                                     @Value("${frontend.url:http://localhost:5173}") String frontendUrl) {
        this.cppUserClient = cppUserClient;
        this.userRepository = userRepository;
        this.securityContextRepository = securityContextRepository;
        setDefaultTargetUrl(frontendUrl);
        setAlwaysUseDefaultTargetUrl(true);
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        if (authentication.getPrincipal() instanceof OAuth2User principal) {
            resolveEmail(principal).ifPresent(email -> {
                User user = userRepository.findByEmail(email).orElseGet(() -> createOAuthUser(principal, email));
                saveAuthentication(principal, authentication, user, request, response);
            });
        }
        super.onAuthenticationSuccess(request, response, authentication);
    }

    private Optional<String> resolveEmail(OAuth2User principal) {
        String email = stringAttribute(principal, DEFAULT_EMAIL_ATTRIBUTE);
        if (email == null || email.isBlank()) {
            email = stringAttribute(principal, EMAIL_ATTRIBUTE);
        }
        return email == null || email.isBlank()
                ? Optional.empty()
                : Optional.of(email.toLowerCase());
    }

    private User createOAuthUser(OAuth2User principal, String email) {
        String login = uniqueLogin(defaultIfBlank(stringAttribute(principal, LOGIN_ATTRIBUTE), loginFromEmail(email)));

        String[] nameParts = resolveNameParts(principal);

        User user = new User();
        user.setEmail(email);
        user.setLogin(login);
        user.setPasswordHash(OAUTH_PASSWORD_HASH);
        user.setFirstName(nameParts[0]);
        user.setLastName(nameParts[1]);
        user.setGroupName(DEFAULT_GROUP_NAME);
        user.setRole(DEFAULT_ROLE);
        User savedUser = userRepository.save(user);

        CppUserClient.Result result = cppUserClient.syncOAuth(Map.of(
                "user_id", String.valueOf(savedUser.getId()),
                "email", savedUser.getEmail(),
                "login", savedUser.getLogin(),
                "password_hash", OAUTH_PASSWORD_HASH,
                "first_name", savedUser.getFirstName(),
                "last_name", savedUser.getLastName(),
                "group_name", savedUser.getGroupName(),
                "role", savedUser.getRole()
        ));
        if (!result.isSuccess()) {
            log.warn("C++ OAuth sync failed for {}: status={}, body={}", email, result.status(), result.body());
        }

        return savedUser;
    }

    private void saveAuthentication(OAuth2User principal, Authentication authentication, User user,
                                    HttpServletRequest request, HttpServletResponse response) {
        List<GrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().toUpperCase()));
        
        // ВАЖНО: в качестве principal устанавливаем email пользователя, а не OAuth2User
        Authentication newAuth = new UsernamePasswordAuthenticationToken(user.getEmail(), authentication.getCredentials(), authorities);
        
        // Сохраняем OAuth2User в details на случай, если он понадобится другим контроллерам
        ((UsernamePasswordAuthenticationToken) newAuth).setDetails(principal);
        
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(newAuth);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }

    private String[] resolveNameParts(OAuth2User principal) {
        String firstName = stringAttribute(principal, FIRST_NAME_ATTRIBUTE);
        String lastName = stringAttribute(principal, LAST_NAME_ATTRIBUTE);

        if ((firstName == null || firstName.isBlank()) && (lastName == null || lastName.isBlank())) {
            String realName = stringAttribute(principal, REAL_NAME_ATTRIBUTE);
            if (realName != null && !realName.isBlank()) {
                String[] parts = realName.trim().split("\\s+", 2);
                firstName = parts[0];
                if (parts.length > 1) {
                    lastName = parts[1];
                }
            }
        }

        return new String[] {
                defaultIfBlank(firstName, "OAuth"),
                defaultIfBlank(lastName, "User")
        };
    }

    private String loginFromEmail(String email) {
        int atIndex = email.indexOf('@');
        return atIndex > 0 ? email.substring(0, atIndex) : email;
    }

    private String uniqueLogin(String baseLogin) {
        String normalizedLogin = baseLogin.replaceAll("[^A-Za-z0-9_.-]", "_");

        if (normalizedLogin.length() < 3) {
            normalizedLogin = "user_" + normalizedLogin;
        }

        String candidate = normalizedLogin;
        int suffix = 1;
        while (userRepository.existsByLogin(candidate)) {
            candidate = normalizedLogin + suffix;
            suffix++;
        }
        return candidate;
    }

    private String stringAttribute(OAuth2User user, String attributeName) {
        Object value = user.getAttribute(attributeName);
        return value == null ? null : value.toString();
    }

    private String defaultIfBlank(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
