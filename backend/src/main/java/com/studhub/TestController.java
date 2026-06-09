package com.studhub;

import com.studhub.auth.CppUserClient;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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

    @GetMapping("/")
    public String home() {
        return "Welcome to StudHub API!";
    }

    @GetMapping("/api/test")
    public String test() {
        return "Backend работает!";
    }

    // Эндпоинт /api/user удалён, так как он теперь в UserController

    @PostMapping("/api/user/change-role")
    public ResponseEntity<?> changeUserRole(@RequestBody Map<String, String> payload, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        String targetUserIdStr = payload.get("target_user_id");
        String newRole = payload.get("role");

        if (targetUserIdStr == null || newRole == null) {
            return ResponseEntity.badRequest().body("Missing target_user_id or role");
        }

        Long targetUserId;
        try {
            targetUserId = Long.parseLong(targetUserIdStr);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body("Invalid target_user_id");
        }

        String email = authentication.getName();
        User admin = userRepository.findByEmail(email).orElse(null);
        if (admin == null || !"ADMIN".equalsIgnoreCase(admin.getRole())) {
            return ResponseEntity.status(403).body("Forbidden");
        }

        CppUserClient.Result result = cppUserClient.changeUserRole(targetUserId, newRole);
        if (!result.isSuccess()) {
            return ResponseEntity.status(result.status()).body(result.body());
        }

        userRepository.findById(targetUserId).ifPresent(user -> {
            user.setRole(newRole.toUpperCase());
            userRepository.save(user);
        });

        return ResponseEntity.ok(Map.of("message", "Role updated"));
    }

    // Вспомогательный метод (если нужен где-то ещё) – можно удалить, но оставим
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