package com.studhub.course.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreateCourseRequest {

    @NotBlank(message = "Название курса обязательно")
    @Size(max = 500)
    private String title;

    @Size(max = 4000)
    private String description;

    @Size(max = 100)
    private String shortName;

    @Size(max = 200)
    private String category;

    private boolean visible = true;
    private boolean enrollmentOpen = true;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getShortName() { return shortName; }
    public void setShortName(String shortName) { this.shortName = shortName; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public boolean isVisible() { return visible; }
    public void setVisible(boolean visible) { this.visible = visible; }

    public boolean isEnrollmentOpen() { return enrollmentOpen; }
    public void setEnrollmentOpen(boolean enrollmentOpen) { this.enrollmentOpen = enrollmentOpen; }
}