package com.studhub.course;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface CourseEnrollmentRepository extends JpaRepository<CourseEnrollment, Long> {

    Optional<CourseEnrollment> findByCourseIdAndUserId(Long courseId, Long userId);

    boolean existsByCourseIdAndUserId(Long courseId, Long userId);

    @Modifying
    @Query("DELETE FROM CourseEnrollment e WHERE e.course.id = :courseId AND e.user.id = :userId")
    void deleteByCourseIdAndUserId(@Param("courseId") Long courseId, @Param("userId") Long userId);
}