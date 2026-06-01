package com.studhub.announcement;

import com.studhub.announcement.dto.AnnouncementDto;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class AnnouncementController {

    private final AnnouncementService announcementService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<AnnouncementDto>> getAll() {
        return ResponseEntity.ok(announcementService.getAll());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, String> payload,
                                    Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String email = authentication.getName();
        User currentUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String content = payload.get("content");
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Content is required"));
        }

        String imageUrl = payload.get("imageUrl");
        AnnouncementDto created = announcementService.create(content, imageUrl, currentUser.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}