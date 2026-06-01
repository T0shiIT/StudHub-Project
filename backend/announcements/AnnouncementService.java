package com.studhub.announcement;

import com.studhub.announcement.dto.AnnouncementDto;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnnouncementService {

    private final AnnouncementRepository announcementRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<AnnouncementDto> getAll() {
        return announcementRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public AnnouncementDto create(String content, String imageUrl, Long authorId) {
        User author = userRepository.findById(authorId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Announcement announcement = new Announcement();
        announcement.setAuthor(author);
        announcement.setContent(content);
        announcement.setImageUrl(imageUrl);

        Announcement saved = announcementRepository.save(announcement);
        return toDto(saved);
    }

    private AnnouncementDto toDto(Announcement a) {
        AnnouncementDto dto = new AnnouncementDto();
        dto.setId(a.getId());
        dto.setContent(a.getContent());
        dto.setImageUrl(a.getImageUrl());
        dto.setCreatedAt(a.getCreatedAt());
        dto.setAuthorName(a.getAuthor().getFirstName() + " " + a.getAuthor().getLastName());
        dto.setAuthorGroup(a.getAuthor().getGroupName());
        return dto;
    }
}