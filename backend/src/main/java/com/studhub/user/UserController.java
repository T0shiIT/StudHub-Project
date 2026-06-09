package com.studhub.user;

import com.studhub.user.dto.UpdateGroupRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class UserController {

    private final UserRepository userRepository;
    private final GroupService groupService;

    public UserController(UserRepository userRepository, GroupService groupService) {
        this.userRepository = userRepository;
        this.groupService = groupService;
    }

    // Вспомогательный метод для извлечения email из Authentication
    private String extractEmail(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof OAuth2User) {
            OAuth2User oAuth2User = (OAuth2User) principal;
            String email = oAuth2User.getAttribute("default_email");
            if (email == null) email = oAuth2User.getAttribute("email");
            return email;
        } else if (principal instanceof UserDetails) {
            return ((UserDetails) principal).getUsername();
        } else if (principal instanceof String) {
            return (String) principal;
        }
        return null;
    }

    // Legacy endpoint для совместимости со старым фронтендом
    @GetMapping("/user")
    public ResponseEntity<?> getUserLegacy(Authentication authentication) {
        return getCurrentUser(authentication);
    }

    // Основной эндпоинт для получения текущего пользователя
    @GetMapping("/user/me")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        try {
            String email = extractEmail(authentication);
            if (email == null) {
                return ResponseEntity.status(401).body(Map.of("error", "Не удалось определить email пользователя"));
            }
            User user = userRepository.findByEmail(email.toLowerCase())
                    .orElse(null);
            if (user == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Пользователь не найден"));
            }
            Map<String, Object> body = new HashMap<>();
            body.put("id", user.getId());
            body.put("login", user.getLogin());
            body.put("email", user.getEmail());
            body.put("firstName", user.getFirstName());
            body.put("lastName", user.getLastName());
            body.put("group", user.getGroupName());
            body.put("role", user.getRole());
            body.put("real_name", user.getFirstName() + " " + user.getLastName());
            body.put("default_email", user.getEmail());
            return ResponseEntity.ok(body);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", "Внутренняя ошибка: " + e.getMessage()));
        }
    }

    @GetMapping("/user/groups")
    public ResponseEntity<List<String>> getAllGroups() {
        return ResponseEntity.ok(groupService.getAllGroupNames());
    }

    @GetMapping("/user/group")
    public ResponseEntity<?> getUserGroup(Authentication authentication) {
        String email = extractEmail(authentication);
        if (email == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        return userRepository.findByEmail(email.toLowerCase())
                .map(user -> ResponseEntity.ok(user.getGroupName() == null ? "" : user.getGroupName()))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/user/group")
    public ResponseEntity<?> updateUserGroup(Authentication authentication,
                                             @RequestBody UpdateGroupRequest request) {
        String email = extractEmail(authentication);
        if (email == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        User user = userRepository.findByEmail(email.toLowerCase())
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        String newGroup = request.getGroupName();
        if (newGroup == null || newGroup.trim().isEmpty()) {
            user.setGroupName(null);
            userRepository.save(user);
            return ResponseEntity.ok().build();
        }
        
        if (!groupService.groupExists(newGroup)) {
            return ResponseEntity.badRequest().body("Группа не найдена");
        }
        
        user.setGroupName(newGroup);
        userRepository.save(user);
        return ResponseEntity.ok().build();
    }
}