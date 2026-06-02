package com.studhub.announcement;

import java.io.Serializable;
import java.time.Instant;

public class Announcement implements Serializable {
    private static final long serialVersionUID = 1L; // Обязательно для сериализации

    private String id;
    private String userId;
    private String userName;
    private String userGroup;
    private String content;
    private String imageUrl;
    private Instant createdAt;
    private String role; // STUDENT, TEACHER, ADMIN

    // ВАЖНО: Пустой конструктор для Jackson (сериализации в Redis)
    public Announcement() {
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    
    public String getUserGroup() { return userGroup; }
    public void setUserGroup(String userGroup) { this.userGroup = userGroup; }
    
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
}