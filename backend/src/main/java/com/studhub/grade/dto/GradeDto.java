package com.studhub.grade.dto;

import java.time.LocalDate;

public class GradeDto {
    private Long id;
    private Long studentId;
    private String studentFullName;
    private Long courseId;
    private String subject;
    private String grade;
    private LocalDate date;
    private Long teacherId;
    private String teacherFullName;

    public GradeDto() {}

    public GradeDto(Long id, Long studentId, String studentFullName, Long courseId, String subject, String grade, LocalDate date, Long teacherId, String teacherFullName) {
        this.id = id;
        this.studentId = studentId;
        this.studentFullName = studentFullName;
        this.courseId = courseId;
        this.subject = subject;
        this.grade = grade;
        this.date = date;
        this.teacherId = teacherId;
        this.teacherFullName = teacherFullName;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public String getStudentFullName() { return studentFullName; }
    public void setStudentFullName(String studentFullName) { this.studentFullName = studentFullName; }
    public Long getCourseId() { return courseId; }
    public void setCourseId(Long courseId) { this.courseId = courseId; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getGrade() { return grade; }
    public void setGrade(String grade) { this.grade = grade; }
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }
    public Long getTeacherId() { return teacherId; }
    public void setTeacherId(Long teacherId) { this.teacherId = teacherId; }
    public String getTeacherFullName() { return teacherFullName; }
    public void setTeacherFullName(String teacherFullName) { this.teacherFullName = teacherFullName; }
}