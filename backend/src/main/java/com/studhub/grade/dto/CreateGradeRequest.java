package com.studhub.grade.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public class CreateGradeRequest {

    @NotNull
    private Long studentId;

    @NotNull
    private Long courseId;

    @NotBlank
    private String subject;

    @NotBlank
    private String grade;

    @NotNull
    private LocalDate date;

    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public Long getCourseId() { return courseId; }
    public void setCourseId(Long courseId) { this.courseId = courseId; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getGrade() { return grade; }
    public void setGrade(String grade) { this.grade = grade; }
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }
}