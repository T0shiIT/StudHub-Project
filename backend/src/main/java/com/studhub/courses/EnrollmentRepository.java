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
    
    // Явный подсчёт количества студентов
    @Query("SELECT COUNT(e) FROM Enrollment e WHERE e.courseId = :courseId")
    int countByCourseId(@Param("courseId") Long courseId);
    
    // Явная проверка существования записи
    @Query("SELECT CASE WHEN COUNT(e) > 0 THEN true ELSE false END FROM Enrollment e WHERE e.courseId = :courseId AND e.userId = :userId")
    boolean existsByCourseIdAndUserId(@Param("courseId") Long courseId, @Param("userId") Long userId);
    
    @Modifying
    @Transactional
    @Query("DELETE FROM Enrollment e WHERE e.courseId = :courseId")
    void deleteByCourseId(@Param("courseId") Long courseId);
}