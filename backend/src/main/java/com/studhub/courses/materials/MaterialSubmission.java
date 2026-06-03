package com.studhub.courses.materials;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "material_submissions")
public class MaterialSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "submission_id")
    private Long id;

    @Column(name = "material_id", nullable = false)
    private Long materialId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "file_path", nullable = false)
    private String filePath;

    @Column(name = "original_filename", nullable = false)
    private String originalFilename;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Column(name = "status", nullable = false)   // ← добавляем поле
    private String status;

    // Конструктор по умолчанию
    public MaterialSubmission() {}

    // Геттеры и сеттеры
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getMaterialId() { return materialId; }
    public void setMaterialId(Long materialId) { this.materialId = materialId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }

    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }

    public Instant getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(Instant submittedAt) { this.submittedAt = submittedAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}