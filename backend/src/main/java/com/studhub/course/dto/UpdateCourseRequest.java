package com.studhub.course.dto;

public class UpdateCourseRequest {
    private String title;
    private String description;
    private String shortName;
    private String category;
    private Boolean visible;
    private Boolean enrollmentOpen;

    // getters and setters
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getShortName() { return shortName; }
    public void setShortName(String shortName) { this.shortName = shortName; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Boolean getVisible() { return visible; }
    public void setVisible(Boolean visible) { this.visible = visible; }
    public Boolean getEnrollmentOpen() { return enrollmentOpen; }
    public void setEnrollmentOpen(Boolean enrollmentOpen) { this.enrollmentOpen = enrollmentOpen; }
}