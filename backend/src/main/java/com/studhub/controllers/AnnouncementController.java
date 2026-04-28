package com.studhub.controller;

import com.studhub.announcement.Announcement;
import com.studhub.dto.AnnouncementDto;
import com.studhub.security.UserDetailsImpl;
import com.studhub.service.AnnouncementService;
import com.studhub.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/announcements")
public class AnnouncementController {

    private final AnnouncementService service;

    public AnnouncementController(AnnouncementService service) { this.service = service; }

    @GetMapping
    public List<AnnouncementDto> getAnnouncements(Authentication auth) {
        User user = ((UserDetailsImpl) auth.getPrincipal()).getUser();
        return service.getForGroup(user.getGroupName());
    }

    @PostMapping
    @PreAuthorize("hasRole('TEACHER')")
    @ResponseStatus(HttpStatus.CREATED)
    public AnnouncementDto create(@Valid @RequestBody AnnouncementRequest req, Authentication auth) {
        User author = ((UserDetailsImpl) auth.getPrincipal()).getUser();
        Announcement a = new Announcement();
        a.setTitle(req.title());
        a.setContent(req.content());
        a.setAuthor(author);
        a.setTargetGroup(req.targetGroup());
        return toDto(service.create(a));
    }

    private AnnouncementDto toDto(Announcement a) {
        return new AnnouncementDto(a.getId(), a.getTitle(), a.getContent(),
                a.getAuthor().getFirstName() + " " + a.getAuthor().getLastName(),
                a.getTargetGroup(), a.getCreatedAt());
    }

    public record AnnouncementRequest(
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 2000) String content,
            @Size(max = 20) String targetGroup   // null – всем
    ) {}
}