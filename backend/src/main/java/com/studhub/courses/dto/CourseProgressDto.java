package com.studhub.courses.dto;

public class CourseProgressDto {
    private int percent; // от 0 до 100

    public CourseProgressDto(int percent) {
        this.percent = percent;
    }

    public int getPercent() {
        return percent;
    }

    public void setPercent(int percent) {
        this.percent = percent;
    }
}