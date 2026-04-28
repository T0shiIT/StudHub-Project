package com.studhub.grade;

import com.studhub.user.User;
import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "grades")
public class Grade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;               // связь с таблицей app_users

    @Column(nullable = false)
    private String subject;

    @Column(nullable = false)
    private int grade;                  // оценка (например, 5‑балльная)

    @Column(nullable = false)
    private LocalDate date;             // дата получения оценки

    @Column(name = "teacher_name")
    private String teacherName;

    public Grade() {}

    public Long getId() { return id; }
    public User getStudent() { return student; }
    public void setStudent(User student) { this.student = student; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public int getGrade() { return grade; }
    public void setGrade(int grade) { this.grade = grade; }
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }
    public String getTeacherName() { return teacherName; }
    public void setTeacherName(String teacherName) { this.teacherName = teacherName; }
}