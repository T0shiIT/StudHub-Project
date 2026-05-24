package com.studhub;

import com.studhub.auth.CppUserClient;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
public class TestController {

    private final UserRepository userRepository;
    private final CppUserClient cppUserClient;

    public TestController(UserRepository userRepository, CppUserClient cppUserClient) {
        this.userRepository = userRepository;
        this.cppUserClient = cppUserClient;
    }

    @GetMapping("/") public String home() { return "Welcome to StudHub API!"; }
    @GetMapping("/api/test") public String test() { return "Backend работает!"; }

    @GetMapping("/api/user")
    public Map<String, Object> user(Authentication authentication, @AuthenticationPrincipal OAuth2User oAuth2User) {
        if (authentication == null || !authentication.isAuthenticated()) return Map.of("error", "User not authenticated");

        String email = null;
        if (oAuth2User != null) {
            email = oAuth2User.getAttribute("default_email");
            if (email == null) email = oAuth2User.getAttribute("email");
        } else {
            email = authentication.getName();
        }

        if (email != null) {
            return userRepository.findByEmail(email.toLowerCase()).map(this::toProfile).orElse(Map.of("error", "User not found"));
        }
        return Map.of("error", "Email not found");
    }

    @PostMapping("/api/user/change-role")
    public ResponseEntity<?> changeUserRole(@RequestBody Map<String, String> payload, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return ResponseEntity.status(401).body("Unauthorized");

        String targetUserIdStr = payload.get("target_user_id");
        String newRole = payload.get("role");

        if (targetUserIdStr == null || newRole == null) return ResponseEntity.badRequest().body("Missing target_user_id or role");

        Long targetUserId;
        try { targetUserId = Long.parseLong(targetUserIdStr); } 
        catch (NumberFormatException e) { return ResponseEntity.badRequest().body("Invalid target_user_id"); }

        String email = authentication.getName();
        User admin = userRepository.findByEmail(email).orElse(null);
        if (admin == null || !"ADMIN".equalsIgnoreCase(admin.getRole())) return ResponseEntity.status(403).body("Forbidden");

        CppUserClient.Result result = cppUserClient.changeUserRole(targetUserId, newRole);
        if (!result.isSuccess()) return ResponseEntity.status(result.status()).body(result.body());

        userRepository.findById(targetUserId).ifPresent(user -> {
            user.setRole(newRole.toUpperCase());
            userRepository.save(user);
        });

        return ResponseEntity.ok(Map.of("message", "Role updated"));
    }

    @GetMapping("/api/cpp-profile")
    public ResponseEntity<?> cppProfile(
            @RequestHeader("X-User-Id") Long userId,
            Authentication authentication
    ) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        CppUserClient.Result result = cppUserClient.getUserProfile(userId);

        return ResponseEntity
                .status(result.status())
                .body(result.body());
    }

    private Map<String, Object> toProfile(User u) {
        Map<String, Object> result = new HashMap<>();
        result.put("id", u.getId());
        result.put("email", u.getEmail());
        result.put("login", u.getLogin());
        result.put("firstName", u.getFirstName());
        result.put("lastName", u.getLastName());
        result.put("group", u.getGroupName());
        result.put("role", u.getRole());
        result.put("real_name", u.getFirstName() + " " + u.getLastName());
        result.put("default_email", u.getEmail());
        return result;
    }
}