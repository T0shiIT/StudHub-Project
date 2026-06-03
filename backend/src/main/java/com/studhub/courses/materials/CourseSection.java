package com.studhub.courses.materials;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "course_sections")
public class CourseSection {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "section_id")
    private Long id;

    @Column(name = "course_id", nullable = false)
    private Long courseId;

    private String title;

    private Integer position;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    public void onCreate() {
        createdAt = Instant.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public Long getCourseId() { return courseId; }
    public void setCourseId(Long courseId) { this.courseId = courseId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Integer getPosition() { return position; }
    public void setPosition(Integer position) { this.position = position; }
    public Instant getCreatedAt() { return createdAt; }
}