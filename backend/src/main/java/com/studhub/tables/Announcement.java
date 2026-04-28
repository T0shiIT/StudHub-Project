package com.studhub.announcement;

import com.studhub.user.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "announcements")
public class Announcement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, length = 2000)
    private String content;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;                    // преподаватель

    @Column(name = "target_group")
    private String targetGroup;             // если null – объявление для всех групп

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    // конструкторы, геттеры, сеттеры
    public Announcement() {}
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public User getAuthor() { return author; }
    public void setAuthor(User author) { this.author = author; }
    public String getTargetGroup() { return targetGroup; }
    public void setTargetGroup(String targetGroup) { this.targetGroup = targetGroup; }
    public Instant getCreatedAt() { return createdAt; }
}