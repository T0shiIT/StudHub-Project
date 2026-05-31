package com.studhub.course.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class CourseRecordDto {
    private Long id;
    private String title;
    private String content;
    private String recordType;
    private LocalDateTime dueDate;
    private LocalDateTime createdAt;
}