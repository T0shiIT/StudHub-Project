package com.studhub;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

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

    @GetMapping("/api/user")
    public Map<String, Object> user(@AuthenticationPrincipal OAuth2User principal) {
        if (principal == null) {
            return Map.of("error", "User not authenticated");
        }
        return principal.getAttributes();
    }
}