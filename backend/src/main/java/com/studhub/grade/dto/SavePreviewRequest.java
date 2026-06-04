package com.studhub.grade.dto;

import java.util.List;
import java.util.Map;

public class SavePreviewRequest {
    private List<StudentPreview> students;
    private List<String> dates;
    private Map<Integer, Map<String, Integer>> grades;
    private String group;
    private String subject = "Основной предмет";

    public static class StudentPreview {
        private int id;
        private String firstName;
        private String lastName;
        private String group;

        public int getId() { return id; }
        public void setId(int id) { this.id = id; }
        public String getFirstName() { return firstName; }
        public void setFirstName(String firstName) { this.firstName = firstName; }
        public String getLastName() { return lastName; }
        public void setLastName(String lastName) { this.lastName = lastName; }
        public String getGroup() { return group; }
        public void setGroup(String group) { this.group = group; }
    }

    public List<StudentPreview> getStudents() { return students; }
    public void setStudents(List<StudentPreview> students) { this.students = students; }
    public List<String> getDates() { return dates; }
    public void setDates(List<String> dates) { this.dates = dates; }
    public Map<Integer, Map<String, Integer>> getGrades() { return grades; }
    public void setGrades(Map<Integer, Map<String, Integer>> grades) { this.grades = grades; }
    public String getGroup() { return group; }
    public void setGroup(String group) { this.group = group; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
}