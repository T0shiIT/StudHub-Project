package com.studhub.schedule;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "schedule_entries")
public class ScheduleEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "group_name", nullable = false)
    private String groupName;   // группа, для которой запись

    @Column(nullable = false)
    private LocalDate date;      // дата занятия

    @Column(nullable = false)
    private LocalTime startTime; // время начала

    @Column(nullable = false)
    private LocalTime endTime;   // время окончания

    @Column(nullable = false)
    private String subject;      // название предмета

    private String room;         // аудитория

    @Column(name = "teacher_name")
    private String teacherName;  // имя преподавателя

    // конструкторы, геттеры, сеттеры (опущены)
    public ScheduleEntry() {}

    public Long getId() { return id; }
    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }
    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getRoom() { return room; }
    public void setRoom(String room) { this.room = room; }
    public String getTeacherName() { return teacherName; }
    public void setTeacherName(String teacherName) { this.teacherName = teacherName; }
}