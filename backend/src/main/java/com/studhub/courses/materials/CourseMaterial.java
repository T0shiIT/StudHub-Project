package com.studhub.courses.materials;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "course_materials")
public class CourseMaterial {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "material_id")
    private Long id;

    @Column(name = "section_id", nullable = false)
    private Long sectionId;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "material_type", nullable = false)
    private String materialType; // FILE, ASSIGNMENT, LINK, TEXT, TEST

    @Column(name = "file_path")
    private String filePath;

    @Column(name = "external_url")
    private String externalUrl;

    @Column(name = "due_date")
    private Instant dueDate;

    private Integer position;

    @Column(name = "created_at")
    private Instant createdAt;

    @PrePersist
    public void onCreate() {
        createdAt = Instant.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSectionId() { return sectionId; }
    public void setSectionId(Long sectionId) { this.sectionId = sectionId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getMaterialType() { return materialType; }
    public void setMaterialType(String materialType) { this.materialType = materialType; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public String getExternalUrl() { return externalUrl; }
    public void setExternalUrl(String externalUrl) { this.externalUrl = externalUrl; }

    public Instant getDueDate() { return dueDate; }
    public void setDueDate(Instant dueDate) { this.dueDate = dueDate; }

    public Integer getPosition() { return position; }
    public void setPosition(Integer position) { this.position = position; }

    public Instant getCreatedAt() { return createdAt; }
}