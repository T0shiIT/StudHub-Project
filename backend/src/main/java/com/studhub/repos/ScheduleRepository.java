package com.studhub.schedule;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ScheduleRepository extends JpaRepository<ScheduleEntry, Long> {
    List<ScheduleEntry> findByGroupName(String groupName);
}