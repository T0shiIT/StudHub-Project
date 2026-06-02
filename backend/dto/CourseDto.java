package com.studhub.course.dto;

import com.studhub.course.CourseStatus;
import com.studhub.course.assignment.dto.AssignmentDto;

import java.time.LocalDateTime;
import java.util.List;

public class CourseDto {
    private Long id;
    private String title;
    private String description;
    private String shortName;
    private String category;
    private CourseStatus status;
    private boolean visible;
    private boolean enrollmentOpen;
    private Long ownerId;
    private String ownerName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<CourseEnrollmentDto> enrollments;
    private List<AssignmentDto> assignments;
    /** Роль текущего пользователя в этом курсе: OWNER, TEACHER, STUDENT или null */
    private String myRole;

    // getters/setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getShortName() { return shortName; }
    public void setShortName(String shortName) { this.shortName = shortName; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public CourseStatus getStatus() { return status; }
    public void setStatus(CourseStatus status) { this.status = status; }

    public boolean isVisible() { return visible; }
    public void setVisible(boolean visible) { this.visible = visible; }

    public boolean isEnrollmentOpen() { return enrollmentOpen; }
    public void setEnrollmentOpen(boolean enrollmentOpen) { this.enrollmentOpen = enrollmentOpen; }

    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }

    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public List<CourseEnrollmentDto> getEnrollments() { return enrollments; }
    public void setEnrollments(List<CourseEnrollmentDto> enrollments) { this.enrollments = enrollments; }

    public List<AssignmentDto> getAssignments() { return assignments; }
    public void setAssignments(List<AssignmentDto> assignments) { this.assignments = assignments; }

    public String getMyRole() { return myRole; }
    public void setMyRole(String myRole) { this.myRole = myRole; }
}