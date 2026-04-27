package com.studhub;

import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
public class TestController {

    private final UserRepository userRepository;

    public TestController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/")
    public String home() {
        return "Welcome to StudHub API!";
    }

    @GetMapping("/api/test")
    public String test() {
        return "Backend работает!";
    }

    @GetMapping("/api/user")
    public Map<String, Object> user(Authentication authentication,
                                    @AuthenticationPrincipal OAuth2User oAuth2User) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return Map.of("error", "User not authenticated");
        }

        // Вход через Yandex OAuth2
        if (oAuth2User != null) {
            return oAuth2User.getAttributes();
        }

        // Обычная регистрация/логин: principal — это email
        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .map(this::toProfile)
                .orElse(Map.of("error", "User not found"));
    }

    private Map<String, Object> toProfile(User u) {
        Map<String, Object> result = new HashMap<>();
        result.put("email", u.getEmail());
        result.put("login", u.getLogin());
        result.put("firstName", u.getFirstName());
        result.put("lastName", u.getLastName());
        result.put("group", u.getGroupName());
        // Поля, которые ожидает текущий profile.tsx
        result.put("real_name", u.getFirstName() + " " + u.getLastName());
        result.put("default_email", u.getEmail());
        return result;
    }
}
