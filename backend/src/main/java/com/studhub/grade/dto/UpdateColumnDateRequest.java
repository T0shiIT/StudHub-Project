package com.studhub.grade.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public class UpdateColumnDateRequest {

    @NotBlank(message = "Group is required")
    private String group;

    @NotBlank(message = "Subject is required")
    private String subject;

    @NotNull(message = "Old date is required")
    private LocalDate oldDate;

    @NotNull(message = "New date is required")
    private LocalDate newDate;

    // Геттеры и сеттеры
    public String getGroup() { return group; }
    public void setGroup(String group) { this.group = group; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public LocalDate getOldDate() { return oldDate; }
    public void setOldDate(LocalDate oldDate) { this.oldDate = oldDate; }

    public LocalDate getNewDate() { return newDate; }
    public void setNewDate(LocalDate newDate) { this.newDate = newDate; }
}