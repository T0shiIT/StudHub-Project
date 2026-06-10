package com.studhub.courses.dto;

public class CourseProgressDto {
    private int percent;
    private boolean hasGradedMaterials;

    public CourseProgressDto(int percent, boolean hasGradedMaterials) {
        this.percent = percent;
        this.hasGradedMaterials = hasGradedMaterials;
    }

    public int getPercent() {
        return percent;
    }

    public void setPercent(int percent) {
        this.percent = percent;
    }

    public boolean isHasGradedMaterials() {
        return hasGradedMaterials;
    }

    public void setHasGradedMaterials(boolean hasGradedMaterials) {
        this.hasGradedMaterials = hasGradedMaterials;
    }
}