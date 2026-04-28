package com.studhub.service;

import com.studhub.announcement.Announcement;
import com.studhub.announcement.AnnouncementRepository;
import com.studhub.dto.AnnouncementDto;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class AnnouncementService {

    private final AnnouncementRepository repo;

    public AnnouncementService(AnnouncementRepository repo) { this.repo = repo; }

    public Announcement create(Announcement announcement) {
        return repo.save(announcement);
    }

    public List<AnnouncementDto> getForGroup(String groupName) {
        return repo.findAllForGroup(groupName).stream()
                .map(a -> new AnnouncementDto(a.getId(), a.getTitle(), a.getContent(),
                        a.getAuthor().getFirstName() + " " + a.getAuthor().getLastName(),
                        a.getTargetGroup(), a.getCreatedAt()))
                .toList();
    }
}