package com.studhub.course.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class EnrollmentDto {
    private Long userId;
    private String userFullName;
    private LocalDateTime enrolledAt;
}