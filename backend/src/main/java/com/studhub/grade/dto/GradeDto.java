package com.studhub.grade.dto;

import java.time.LocalDate;

public class GradeDto {
    private Long id;
    private Long studentId;
    private String studentFullName;
    private String subject;
    private String grade;
    private LocalDate date;
    private Long teacherId;
    private String teacherFullName;

    public GradeDto() {}

    public GradeDto(Long id, Long studentId, String studentFullName, String subject,
                    String grade, LocalDate date, Long teacherId, String teacherFullName) {
        this.id = id;
        this.studentId = studentId;
        this.studentFullName = studentFullName;
        this.subject = subject;
        this.grade = grade;
        this.date = date;
        this.teacherId = teacherId;
        this.teacherFullName = teacherFullName;
    }
}