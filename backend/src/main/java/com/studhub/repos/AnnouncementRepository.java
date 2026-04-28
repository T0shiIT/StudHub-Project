package com.studhub.announcement;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    @Query("SELECT a FROM Announcement a WHERE a.targetGroup IS NULL OR a.targetGroup = :group")
    List<Announcement> findAllForGroup(@Param("group") String group);
}