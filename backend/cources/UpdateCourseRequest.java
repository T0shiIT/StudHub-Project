package com.studhub.course.dto;

import lombok.Data;

@Data
public class UpdateCourseRequest {
    private String title;
    private String description;
    private Boolean archived;
}