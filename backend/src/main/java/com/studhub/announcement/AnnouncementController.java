package com.studhub.announcement;

import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/announcements")
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true")
public class AnnouncementController {
    
    private final AnnouncementRepository announcementRepository;
    private final UserRepository userRepository;
    
    public AnnouncementController(AnnouncementRepository announcementRepository, 
                                  UserRepository userRepository) {
        this.announcementRepository = announcementRepository;
        this.userRepository = userRepository;
    }
    
    // Получить все объявления
    @GetMapping
    public ResponseEntity<List<Announcement>> getAnnouncements() {
        List<Announcement> announcements = announcementRepository.getAllAnnouncements();
        return ResponseEntity.ok(announcements);
    }
    
    // Создать объявление
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
            
            // Устанавливаем данные реального пользователя
            announcement.setUserId(String.valueOf(currentUser.getId()));
            announcement.setUserName(currentUser.getFirstName() + " " + currentUser.getLastName());
            announcement.setUserGroup(currentUser.getGroupName() != null ? currentUser.getGroupName() : "—");
            announcement.setRole(currentUser.getRole());
            
            Announcement saved = announcementRepository.addAnnouncement(announcement);
            return ResponseEntity.ok(saved);
            
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", "Ошибка сервера: " + e.getMessage()));
        }
    }
    
    // Удалить объявление
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
            
            // Проверяем, существует ли объявление
            List<Announcement> all = announcementRepository.getAllAnnouncements();
            Announcement target = all.stream()
                    .filter(a -> a.getId().equals(id))
                    .findFirst()
                    .orElse(null);
            
            if (target == null) {
                return ResponseEntity.status(404).body(Map.of("error", "Объявление не найдено"));
            }
            
            // Проверяем права: удалять может только автор ИЛИ администратор
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