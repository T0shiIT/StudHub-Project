package com.studhub.courses.materials;

import jakarta.persistence.*;

@Entity
@Table(name = "answer_options")
public class AnswerOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String text;

    @ManyToOne
    @JoinColumn(name = "question_id", nullable = false)
    private TestQuestion question;

    public AnswerOption() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public TestQuestion getQuestion() { return question; }
    public void setQuestion(TestQuestion question) { this.question = question; }
}