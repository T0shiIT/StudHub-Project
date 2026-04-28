package com.studhub.service;

import com.studhub.dto.ScheduleDto;
import com.studhub.schedule.ScheduleEntry;
import com.studhub.schedule.ScheduleRepository;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class ScheduleService {

    private final ScheduleRepository repo;

    public ScheduleService(ScheduleRepository repo) { this.repo = repo; }

    public List<ScheduleDto> getScheduleForGroup(String groupName) {
        return repo.findByGroupName(groupName).stream()
                .map(e -> new ScheduleDto(e.getId(), e.getGroupName(),
                        e.getDate(), e.getStartTime(), e.getEndTime(),
                        e.getSubject(), e.getRoom(), e.getTeacherName()))
                .toList();
    }

    public void saveAll(List<ScheduleEntry> entries) {
        repo.saveAll(entries);
    }
}