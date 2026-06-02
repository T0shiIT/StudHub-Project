package com.studhub.course.dto;

import java.time.LocalDateTime;

public class CourseEnrollmentDto {
    private Long userId;
    private String userFullName;
    private String userEmail;
    private String userLogin;
    private String courseRole;
    private LocalDateTime enrolledAt;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUserFullName() { return userFullName; }
    public void setUserFullName(String userFullName) { this.userFullName = userFullName; }

    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }

    public String getUserLogin() { return userLogin; }
    public void setUserLogin(String userLogin) { this.userLogin = userLogin; }

    public String getCourseRole() { return courseRole; }
    public void setCourseRole(String courseRole) { this.courseRole = courseRole; }

    public LocalDateTime getEnrolledAt() { return enrolledAt; }
    public void setEnrolledAt(LocalDateTime enrolledAt) { this.enrolledAt = enrolledAt; }
}