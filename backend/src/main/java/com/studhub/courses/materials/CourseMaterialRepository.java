package com.studhub.courses.materials;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface CourseMaterialRepository extends JpaRepository<CourseMaterial, Long> {
    List<CourseMaterial> findBySectionId(Long sectionId);

    // ✅ Метод, требуемый MaterialController
    List<CourseMaterial> findBySectionIdOrderByPosition(Long sectionId);

    // ✅ Все материалы курса
    @Query("SELECT m FROM CourseMaterial m WHERE m.sectionId IN (SELECT s.id FROM CourseSection s WHERE s.courseId = :courseId)")
    List<CourseMaterial> findAllByCourseId(@Param("courseId") Long courseId);
}