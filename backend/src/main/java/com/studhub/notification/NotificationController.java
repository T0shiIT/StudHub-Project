package com.studhub.notification;

import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public NotificationController(NotificationService notificationService,
                                  UserRepository userRepository) {
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<?> getNotifications(Authentication auth,
                                              @RequestParam(defaultValue = "50") int limit) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        User user = userRepository.findByEmail(auth.getName()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "User not found"));
        }
        return ResponseEntity.ok(notificationService.getUserNotifications(user.getId(), limit));
    }

    @PatchMapping("/mark-read")
    public ResponseEntity<?> markAsRead(@RequestBody List<Long> ids, Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        User user = userRepository.findByEmail(auth.getName()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "User not found"));
        }
        notificationService.markAsRead(user.getId(), ids);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @PatchMapping("/mark-all-read")
    public ResponseEntity<?> markAllAsRead(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        User user = userRepository.findByEmail(auth.getName()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "User not found"));
        }
        notificationService.markAllAsRead(user.getId());
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}