package com.studhub.schedule;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ScheduleUploadRepository extends JpaRepository<ScheduleUpload, Long> {
    Optional<ScheduleUpload> findTopByOrderByCreatedAtDesc();

    List<ScheduleUpload> findAllByOrderByCreatedAtDesc();
}
