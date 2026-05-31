package com.studhub.course.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateCourseRequest {
    @NotBlank
    private String title;
    private String description;
    @NotNull
    private Long teacherId;
}