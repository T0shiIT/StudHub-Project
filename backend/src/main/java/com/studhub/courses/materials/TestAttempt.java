package com.studhub.courses.materials;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "test_attempts")
public class TestAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "material_id", nullable = false)
    private Long materialId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "score_percent", nullable = false)
    private Integer scorePercent;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    public TestAttempt() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getMaterialId() { return materialId; }
    public void setMaterialId(Long materialId) { this.materialId = materialId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Integer getScorePercent() { return scorePercent; }
    public void setScorePercent(Integer scorePercent) { this.scorePercent = scorePercent; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
}