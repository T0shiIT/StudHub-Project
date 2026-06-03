package com.studhub.courses.materials;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CourseMaterialRepository extends JpaRepository<CourseMaterial, Long> {
    List<CourseMaterial> findBySectionIdOrderByPosition(Long sectionId);
}