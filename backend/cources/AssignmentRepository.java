package com.studhub.course.assignment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AssignmentRepository extends JpaRepository<Assignment, Long> {

    /** Активные задания курса */
    List<Assignment> findByCourseIdAndStatusOrderBySortOrderAscCreatedAtAsc(Long courseId, AssignmentStatus status);

    /** Все не-удалённые задания курса */
    @Query("""
            SELECT a FROM Assignment a
            WHERE a.course.id = :courseId
              AND a.status <> com.studhub.course.assignment.AssignmentStatus.DELETED
            ORDER BY a.sortOrder ASC, a.createdAt ASC
            """)
    List<Assignment> findNotDeletedByCourseId(@Param("courseId") Long courseId);

    /** Найти по id и courseId (чтобы нельзя было обращаться к чужому заданию) */
    Optional<Assignment> findByIdAndCourseId(Long id, Long courseId);
}