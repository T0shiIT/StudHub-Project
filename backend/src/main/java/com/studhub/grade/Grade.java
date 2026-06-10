package com.studhub.grade;

import com.studhub.user.User;
import com.studhub.courses.Course;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "grades", 
    indexes = {
        @Index(name = "idx_grade_student", columnList = "student_id"),
        @Index(name = "idx_grade_subject", columnList = "subject"),
        @Index(name = "idx_grade_course", columnList = "course_id")
    },
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_student_subject_date_course", columnNames = {"student_id", "subject", "date", "course_id"})
    }
)
public class Grade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(nullable = false)
    private String subject;

    @Column(nullable = false)
    private String grade;

    @Column(nullable = false)
    private LocalDate date;

    @ManyToOne
    @JoinColumn(name = "teacher_id")
    private User teacher;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() { createdAt = Instant.now(); }

    @PreUpdate
    protected void onUpdate() { updatedAt = Instant.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getStudent() { return student; }
    public void setStudent(User student) { this.student = student; }
    public Course getCourse() { return course; }
    public void setCourse(Course course) { this.course = course; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getGrade() { return grade; }
    public void setGrade(String grade) { this.grade = grade; }
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }
    public User getTeacher() { return teacher; }
    public void setTeacher(User teacher) { this.teacher = teacher; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}