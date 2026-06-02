package com.studhub.announcement;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.*;

@Repository
public class AnnouncementRepository {
    
    private static final String KEY_PREFIX = "announcements:";
    private final RedisTemplate<String, Object> redisTemplate;
    
    public AnnouncementRepository(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }
    
    // Добавить объявление в начало списка
    public Announcement addAnnouncement(Announcement announcement) {
        String key = KEY_PREFIX + "list";
        announcement.setId(UUID.randomUUID().toString());
        announcement.setCreatedAt(Instant.now());
        
        redisTemplate.opsForList().leftPush(key, announcement);
        // Храним последние 100 объявлений
        redisTemplate.opsForList().trim(key, 0, 99);
        
        return announcement;
    }
    
    // Получить все объявления
    public List<Announcement> getAllAnnouncements() {
        String key = KEY_PREFIX + "list";
        List<Object> objects = redisTemplate.opsForList().range(key, 0, -1);
        
        if (objects == null) {
            return new ArrayList<>();
        }
        
        List<Announcement> announcements = new ArrayList<>();
        for (Object obj : objects) {
            if (obj instanceof Announcement) {
                announcements.add((Announcement) obj);
            }
        }
        return announcements;
    }
    
    // Удалить объявление
    public void deleteAnnouncement(String id) {
        String key = KEY_PREFIX + "list";
        List<Object> objects = redisTemplate.opsForList().range(key, 0, -1);
        
        if (objects != null) {
            for (int i = 0; i < objects.size(); i++) {
                if (objects.get(i) instanceof Announcement) {
                    Announcement announcement = (Announcement) objects.get(i);
                    if (announcement.getId().equals(id)) {
                        redisTemplate.opsForList().remove(key, 1, announcement);
                        break;
                    }
                }
            }
        }
    }
}