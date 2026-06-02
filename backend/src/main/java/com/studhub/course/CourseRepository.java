package com.studhub.course;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface CourseRepository extends JpaRepository<Course, Long> {

    List<Course> findByStatusAndVisibleTrue(CourseStatus status);

    @Query("SELECT c FROM Course c WHERE c.status <> com.studhub.course.CourseStatus.DELETED ORDER BY c.createdAt DESC")
    List<Course> findAllNotDeleted();

    @Query("SELECT c FROM Course c JOIN c.enrollments e WHERE e.user.id = :userId AND c.status <> com.studhub.course.CourseStatus.DELETED ORDER BY c.createdAt DESC")
    List<Course> findEnrolledCourses(@Param("userId") Long userId);

    @Query("SELECT c FROM Course c WHERE c.owner.id = :ownerId AND c.status <> com.studhub.course.CourseStatus.DELETED ORDER BY c.createdAt DESC")
    List<Course> findOwnedCourses(@Param("ownerId") Long ownerId);
}