package com.studhub.courses.materials;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CourseSectionRepository extends JpaRepository<CourseSection, Long> {
    List<CourseSection> findByCourseIdOrderByPosition(Long courseId);
}