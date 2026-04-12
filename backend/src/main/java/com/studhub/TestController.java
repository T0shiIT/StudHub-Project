package com.studhub;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TestController {
    
    @GetMapping("/")
    public String home() {
        return "Welcome to StudHub API!";
    }
    
    @GetMapping("/api/test")
    public String test() {
        return "Backend работает!";
    }

    // Новый метод для проверки данных пользователя
    @GetMapping("/api/user")
    public Map<String, Object> user(@AuthenticationPrincipal OAuth2User principal) {
        // Вернет ID, email, имя и другие данные, разрешенные в scope
        return principal.getAttributes();
    }
}