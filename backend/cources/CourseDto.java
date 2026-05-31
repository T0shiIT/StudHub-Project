package com.studhub.course.dto;

import lombok.Data;
import java.util.List;

@Data
public class CourseDto {
    private Long id;
    private String title;
    private String description;
    private Long teacherId;
    private String teacherName;
    private boolean archived;
    private List<EnrollmentDto> enrollments;
    private List<CourseRecordDto> records;
}