package com.studhub.course;

import com.studhub.user.User;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "course_enrollments",
        uniqueConstraints = @UniqueConstraint(columnNames = {"course_id", "user_id"}))
public class CourseEnrollment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Роль в курсе: STUDENT, TEACHER, ADMIN */
    @Column(name = "course_role", nullable = false, length = 20)
    private String courseRole = "STUDENT";

    @Column(name = "enrolled_at", updatable = false)
    private LocalDateTime enrolledAt;

    @PrePersist
    void onCreate() { enrolledAt = LocalDateTime.now(); }

    // getters / setters

    public Long getId() { return id; }

    public Course getCourse() { return course; }
    public void setCourse(Course course) { this.course = course; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getCourseRole() { return courseRole; }
    public void setCourseRole(String courseRole) { this.courseRole = courseRole; }

    public LocalDateTime getEnrolledAt() { return enrolledAt; }
}