package com.studhub.notification;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Публикует события уведомлений в Redis Pub/Sub.
 *
 * Каналы:
 *   notifications:user:{userId}  — для конкретного пользователя
 *   notifications:all            — для всех онлайн-пользователей
 */
@Component
public class RedisNotificationPublisher {

    private static final Logger log = LoggerFactory.getLogger(RedisNotificationPublisher.class);
    private static final String USER_CHANNEL_PREFIX = "notifications:user:";
    private static final String ALL_CHANNEL = "notifications:all";

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    public RedisNotificationPublisher(StringRedisTemplate stringRedisTemplate,
                                      ObjectMapper objectMapper) {
        this.stringRedisTemplate = stringRedisTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Публикует событие конкретному пользователю.
     *
     * @param userId     ID получателя
     * @param type       тип события: new_announcement / schedule_updated / grade_updated
     * @param title      заголовок уведомления
     * @param body       текст уведомления
     * @param link       URL для перехода (например, "/announcements")
     */
    public void publishToUser(Long userId, String type, String title, String body, String link) {
        String channel = USER_CHANNEL_PREFIX + userId;
        String payload = buildPayload(type, title, body, userId, link);
        publish(channel, payload);
    }

    /**
     * Публикует событие всем подписанным пользователям.
     *
     * @param type   тип события
     * @param title  заголовок уведомления
     * @param body   текст уведомления
     * @param link   URL для перехода
     */
    public void publishToAll(String type, String title, String body, String link) {
        String payload = buildPayload(type, title, body, 0L, link);
        publish(ALL_CHANNEL, payload);
    }

    // ─────────────────────────────────────────────

    private String buildPayload(String type, String title, String body, Long targetUserId, String link) {
        Map<String, Object> event = new HashMap<>();
        event.put("type", type);
        event.put("title", title);
        event.put("body", body);
        event.put("targetUserId", targetUserId);
        event.put("link", link);
        event.put("timestamp", Instant.now().toEpochMilli());

        try {
            return objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize notification event", e);
            return "{}";
        }
    }

    private void publish(String channel, String payload) {
        try {
            stringRedisTemplate.convertAndSend(channel, payload);
            log.debug("Published notification to channel '{}': {}", channel, payload);
        } catch (Exception e) {
            log.error("Failed to publish notification to channel '{}'", channel, e);
        }
    }
}
