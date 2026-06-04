package com.studhub.grade.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdateGradeRequest {

    @NotBlank(message = "Grade is required")
    private String grade;

    // Конструктор по умолчанию (нужен для Jackson)
    public UpdateGradeRequest() {}

    // Геттер и сеттер
    public String getGrade() {
        return grade;
    }

    public void setGrade(String grade) {
        this.grade = grade;
    }
}