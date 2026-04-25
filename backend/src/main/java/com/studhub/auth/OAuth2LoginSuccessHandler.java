package com.studhub.auth;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * После успешной авторизации через OAuth2 (Yandex) синхронизирует пользователя
 * в БД через C++ сервис и редиректит на фронтенд.
 */
@Component
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuth2LoginSuccessHandler.class);

    private final CppUserClient cppUserClient;
    private final String frontendUrl;

    public OAuth2LoginSuccessHandler(CppUserClient cppUserClient,
                                     @Value("${frontend.url:http://localhost:5173}") String frontendUrl) {
        this.cppUserClient = cppUserClient;
        this.frontendUrl = frontendUrl;
        setDefaultTargetUrl(frontendUrl);
        setAlwaysUseDefaultTargetUrl(true);
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        if (authentication.getPrincipal() instanceof OAuth2User principal) {
            try {
                Map<String, String> payload = buildPayload(principal);
                CppUserClient.Result result = cppUserClient.syncOAuth(payload);
                if (!result.isSuccess()) {
                    log.warn("OAuth2 user sync failed (status={}): {}", result.status(), result.body());
                }
            } catch (Exception e) {
                // Не блокируем вход в систему из-за проблем синхронизации с БД.
                log.error("Failed to sync OAuth2 user with C++ service", e);
            }
        }

        super.onAuthenticationSuccess(request, response, authentication);
    }

    private Map<String, String> buildPayload(OAuth2User principal) {
        Map<String, Object> attrs = principal.getAttributes();

        String email = stringAttr(attrs, "default_email");
        if (email == null || email.isBlank()) {
            email = stringAttr(attrs, "email");
        }
        String yandexLogin = stringAttr(attrs, "login");
        String externalId = stringAttr(attrs, "id");
        // Чтобы yandex-логин не конфликтовал с обычной регистрацией.
        String login = "yandex:" + (yandexLogin != null && !yandexLogin.isBlank()
                ? yandexLogin
                : (externalId != null ? externalId : (email != null ? email : "unknown")));

        String firstName = stringAttr(attrs, "first_name");
        String lastName = stringAttr(attrs, "last_name");
        if ((firstName == null || firstName.isBlank()) && (lastName == null || lastName.isBlank())) {
            String realName = stringAttr(attrs, "real_name");
            if (realName != null && !realName.isBlank()) {
                String[] parts = realName.trim().split("\\s+", 2);
                firstName = parts[0];
                lastName = parts.length > 1 ? parts[1] : "";
            }
        }

        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("email", email == null ? "" : email.toLowerCase());
        payload.put("login", login);
        payload.put("first_name", firstName == null ? "" : firstName);
        payload.put("last_name", lastName == null ? "" : lastName);
        payload.put("group_name", "—");
        payload.put("password_hash", "oauth:yandex");
        return payload;
    }

    private String stringAttr(Map<String, Object> attrs, String key) {
        Object v = attrs.get(key);
        return v == null ? null : v.toString();
    }
}
