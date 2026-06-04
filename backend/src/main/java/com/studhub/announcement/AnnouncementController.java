package com.studhub.announcement;

import com.studhub.notification.NotificationService;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/announcements")
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
public class AnnouncementController {

    private final AnnouncementRepository announcementRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public AnnouncementController(AnnouncementRepository announcementRepository,
                                  UserRepository userRepository,
                                  NotificationService notificationService) {
        this.announcementRepository = announcementRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<List<Announcement>> getAnnouncements() {
        return ResponseEntity.ok(announcementRepository.getAllAnnouncements());
    }

    @PostMapping
    public ResponseEntity<?> createAnnouncement(
            @RequestBody Map<String, String> body,
            Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Необходима авторизация"));
        }

        try {
            String email = authentication.getName();
            User currentUser = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

            Announcement announcement = new Announcement();
            announcement.setContent(body.get("content"));
            announcement.setImageUrl(body.get("imageUrl"));
            announcement.setUserId(String.valueOf(currentUser.getId()));
            announcement.setUserName(currentUser.getFirstName() + " " + currentUser.getLastName());
            announcement.setUserGroup(currentUser.getGroupName() != null ? currentUser.getGroupName() : "—");
            announcement.setRole(currentUser.getRole());

            Announcement saved = announcementRepository.addAnnouncement(announcement);

            // ── Уведомление ──────────────────────────────────────────────────────
            String authorName = currentUser.getFirstName() + " " + currentUser.getLastName();
            String content = body.getOrDefault("content", "");
            String preview = content.length() > 80 ? content.substring(0, 80) + "…" : content;
            notificationService.notifyNewAnnouncement(authorName, preview);
            // ─────────────────────────────────────────────────────────────────────

            return ResponseEntity.ok(saved);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", "Ошибка сервера: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAnnouncement(@PathVariable String id,
                                                 Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Необходима авторизация"));
        }

        try {
            String email = authentication.getName();
            User currentUser = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("Пользователь не найден"));

            List<Announcement> all = announcementRepository.getAllAnnouncements();
            Announcement target = all.stream()
                    .filter(a -> a.getId().equals(id))
                    .findFirst()
                    .orElse(null);

            if (target == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Объявление не найдено"));
            }

            boolean isOwner = target.getUserId().equals(String.valueOf(currentUser.getId()));
            boolean isAdmin = "ADMIN".equalsIgnoreCase(currentUser.getRole());

            if (!isOwner && !isAdmin) {
                return ResponseEntity.status(403)
                        .body(Map.of("error", "Вы можете удалять только свои объявления"));
            }

            announcementRepository.deleteAnnouncement(id);
            return ResponseEntity.ok(Map.of("message", "Объявление успешно удалено"));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", "Ошибка сервера при удалении"));
        }
    }
}
