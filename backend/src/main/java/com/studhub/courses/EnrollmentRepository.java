package com.studhub.courses;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {
    List<Enrollment> findByUserId(Long userId);
    List<Enrollment> findByCourseId(Long courseId);
    Optional<Enrollment> findByCourseIdAndUserId(Long courseId, Long userId);
    boolean existsByCourseIdAndUserId(Long courseId, Long userId);
    
    @Modifying
    @Transactional
    @Query("DELETE FROM Enrollment e WHERE e.courseId = :courseId")
    void deleteByCourseId(@Param("courseId") Long courseId);
}