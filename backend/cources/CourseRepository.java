package com.studhub.course;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CourseRepository extends JpaRepository<Course, Long> {

    /** Все активные видимые курсы */
    List<Course> findByStatusAndVisibleTrue(CourseStatus status);

    /** Все не-удалённые (для админа) */
    @Query("SELECT c FROM Course c WHERE c.status <> com.studhub.course.CourseStatus.DELETED ORDER BY c.createdAt DESC")
    List<Course> findAllNotDeleted();

    /** Курсы, в которых участвует пользователь */
    @Query("""
            SELECT c FROM Course c
            JOIN c.enrollments e
            WHERE e.user.id = :userId
              AND c.status <> com.studhub.course.CourseStatus.DELETED
            ORDER BY c.createdAt DESC
            """)
    List<Course> findEnrolledCourses(@Param("userId") Long userId);

    /** Курсы, которыми владеет пользователь (создатель) */
    @Query("""
            SELECT c FROM Course c
            WHERE c.owner.id = :ownerId
              AND c.status <> com.studhub.course.CourseStatus.DELETED
            ORDER BY c.createdAt DESC
            """)
    List<Course> findOwnedCourses(@Param("ownerId") Long ownerId);
}