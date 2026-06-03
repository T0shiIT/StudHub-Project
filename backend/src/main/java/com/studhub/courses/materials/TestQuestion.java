package com.studhub.courses.materials;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "test_questions")
public class TestQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;

    @ManyToOne
    @JoinColumn(name = "material_id", nullable = false)
    private CourseMaterial material;

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AnswerOption> options = new ArrayList<>();

    @ManyToOne
    @JoinColumn(name = "correct_option_id")
    private AnswerOption correctOption;

    // Конструктор по умолчанию
    public TestQuestion() {}

    // Геттеры и сеттеры
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public CourseMaterial getMaterial() { return material; }
    public void setMaterial(CourseMaterial material) { this.material = material; }

    public List<AnswerOption> getOptions() { return options; }
    public void setOptions(List<AnswerOption> options) { this.options = options; }

    public AnswerOption getCorrectOption() { return correctOption; }
    public void setCorrectOption(AnswerOption correctOption) { this.correctOption = correctOption; }
}