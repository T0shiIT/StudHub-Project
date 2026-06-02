package com.studhub.announcement;

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
    
    public AnnouncementController(AnnouncementRepository announcementRepository) {
        this.announcementRepository = announcementRepository;
    }
    
    @GetMapping
    public ResponseEntity<List<Announcement>> getAnnouncements() {
        List<Announcement> announcements = announcementRepository.getAllAnnouncements();
        return ResponseEntity.ok(announcements);
    }
    
    @PostMapping
    public ResponseEntity<?> createAnnouncement(
            @RequestBody Map<String, String> body,
            Authentication authentication) {
        
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        
        try {
            Announcement announcement = new Announcement();
            announcement.setContent(body.get("content"));
            announcement.setImageUrl(body.get("imageUrl"));
            
            // Пока используем ваши заглушки
            announcement.setUserId("1");
            announcement.setUserName("T Toshi");
            announcement.setUserGroup("ПИ-252(2)");
            announcement.setRole("STUDENT");
            
            Announcement saved = announcementRepository.addAnnouncement(announcement);
            return ResponseEntity.ok(saved);
            
        } catch (Exception e) {
            // ЭТОТ БЛОК ВЫВЕДЕТ ТОЧНУЮ ПРИЧИНУ ОШИБКИ В ЛОГИ DOCKER
            e.printStackTrace(); 
            return ResponseEntity.status(500).body(Map.of("error", "Ошибка сервера: " + e.getMessage()));
        }
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAnnouncement(@PathVariable String id) {
        announcementRepository.deleteAnnouncement(id);
        return ResponseEntity.ok().build();
    }
}