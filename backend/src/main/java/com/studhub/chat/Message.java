package com.studhub.chat;

import com.studhub.user.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "messages")
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "receiver_id", nullable = false)
    private User receiver;

    @Column(nullable = false, length = 2000)
    private String content;

    @Column(name = "sent_at", nullable = false)
    private Instant sentAt;

    @Column(nullable = false)
    private boolean read = false;

    @PrePersist
    void onCreate() {
        this.sentAt = Instant.now();
    }

    public Message() {}
    // геттеры/сеттеры
    public Long getId() { return id; }
    public User getSender() { return sender; }
    public void setSender(User sender) { this.sender = sender; }
    public User getReceiver() { return receiver; }
    public void setReceiver(User receiver) { this.receiver = receiver; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Instant getSentAt() { return sentAt; }
    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }
}