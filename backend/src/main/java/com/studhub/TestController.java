package com.studhub;

import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.http.ResponseEntity; // ТЕСТ РОУТА НА ПОЛУЧЕНИЕ ДАННЫХ
import org.springframework.web.client.RestTemplate; //ТЕСТ РОУТА НА ПОЛУЧЕНИЕ ДАННЫХ
import org.springframework.web.bind.annotation.RequestHeader; //ТЕСТ РОУТА НА ПОЛУЧЕНИЕ ДАННЫЙ №2

import java.util.HashMap;
import java.util.Map;

@RestController
public class TestController {

    private final UserRepository userRepository;
    //ТЕСТ РОУТА НА ПОЛУЧЕНИЕ ДАННЫХ
    private final RestTemplate restTemplate = new RestTemplate();

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

    @GetMapping("/api/cpp-profile")
    public ResponseEntity<String> getCppProfile(@RequestHeader(value = "X-User-Id", required = false) String userId, 
    Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body("User not authenticated");
        }

        String cppUrl = "http://cpp:8081/api/cpp/profile/" + userId;

        try {
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("X-User-Id", userId);
            org.springframework.http.HttpEntity<String> entity = new org.springframework.http.HttpEntity<>(headers);
           
           return restTemplate.exchange(
            cppUrl, 
            org.springframework.http.HttpMethod.GET, 
            entity, 
            String.class
        );
        } catch (Exception e) {
            // Если Crow упадет или база в С++ отвалится, увидим здесь
            return ResponseEntity.status(500).body("C++ Backend Error: " + e.getMessage());
        }
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
