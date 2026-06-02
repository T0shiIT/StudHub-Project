package com.studhub.course.dto;

import jakarta.validation.constraints.NotNull;

public class AddMemberRequest {
    @NotNull private Long userId;
    private String courseRole = "STUDENT";

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getCourseRole() { return courseRole; }
    public void setCourseRole(String courseRole) { this.courseRole = courseRole; }
}