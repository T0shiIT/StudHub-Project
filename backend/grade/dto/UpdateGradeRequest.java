package com.studhub.grade.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class UpdateGradeRequest {
    @NotBlank
    private String grade;

    @NotNull
    private Long teacherId;

    // Геттеры и сеттеры
    public String getGrade() { return grade; }
    public void setGrade(String grade) { this.grade = grade; }

    public Long getTeacherId() { return teacherId; }
    public void setTeacherId(Long teacherId) { this.teacherId = teacherId; }
}