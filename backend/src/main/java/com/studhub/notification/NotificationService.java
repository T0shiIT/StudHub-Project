package com.studhub.notification;

import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final RedisNotificationPublisher publisher;

    public NotificationService(NotificationRepository notificationRepository,
                               UserRepository userRepository,
                               RedisNotificationPublisher publisher) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.publisher = publisher;
    }

    // ─── Schedule ──────────────────────────────────────────────────────────────

    /**
     * Сохраняет уведомления об обновлении расписания в БД и публикует
     * событие в Redis для всех пользователей.
     */
    @Transactional
    public void notifyScheduleUpdate(String fileName, String uploadedBy) {
        List<User> recipients = userRepository.findAllStudentsAndTeachers();
        if (recipients.isEmpty()) return;

        String message = String.format("📅 Обновлено расписание: %s (загрузил %s)", fileName, uploadedBy);
        Instant now = Instant.now();
        List<Notification> notifications = new ArrayList<>(recipients.size());

        for (User user : recipients) {
            Notification n = buildNotification(user, message, "SCHEDULE_UPDATE", now);
            notifications.add(n);
        }

        notificationRepository.saveAll(notifications);

        // Публикуем одно событие "для всех" — Go-мессенджер разошлёт онлайн-пользователям
        publisher.publishToAll(
                "schedule_updated",
                "Обновлено расписание",
                fileName + " (загрузил " + uploadedBy + ")",
                "/schedule"
        );
    }

    // ─── Announcement ───────────────────────────────────────────────────────────

    /**
     * Сохраняет уведомление о новом объявлении и публикует Redis-событие всем.
     *
     * @param authorName  имя автора (для текста уведомления)
     * @param preview     первые ~80 символов текста объявления
     */
    @Transactional
    public void notifyNewAnnouncement(String authorName, String preview) {
        List<User> recipients = userRepository.findAllStudentsAndTeachers();
        if (recipients.isEmpty()) return;

        String message = String.format("📢 Новое объявление от %s: %s", authorName, preview);
        Instant now = Instant.now();
        List<Notification> notifications = new ArrayList<>(recipients.size());

        for (User user : recipients) {
            Notification n = buildNotification(user, message, "NEW_ANNOUNCEMENT", now);
            notifications.add(n);
        }

        notificationRepository.saveAll(notifications);

        publisher.publishToAll(
                "new_announcement",
                "Новое объявление",
                authorName + ": " + preview,
                "/announcements"
        );
    }

    // ─── Grade ─────────────────────────────────────────────────────────────────

    /**
     * Сохраняет уведомление об оценке и публикует Redis-событие конкретному студенту.
     *
     * @param student    студент-получатель
     * @param subject    предмет
     * @param grade      значение оценки
     * @param isNew      true — новая оценка, false — обновление
     */
    @Transactional
    public void notifyGrade(User student, String subject, String grade, boolean isNew) {
        String action = isNew ? "выставлена" : "обновлена";
        String message = String.format("📝 Оценка %s по предмету «%s»: %s", action, subject, grade);

        Notification n = buildNotification(student, message, "GRADE_UPDATED", Instant.now());
        notificationRepository.save(n);

        publisher.publishToUser(
                student.getId(),
                "grade_updated",
                "Новая оценка",
                String.format("По предмету «%s» %s оценка: %s", subject, action, grade),
                "/grades"
        );
    }

    // ─── Read ───────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Notification> getUserNotifications(Long userId, int limit) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, limit));
    }

    @Transactional
    public void markAsRead(Long userId, List<Long> ids) {
        if (ids == null || ids.isEmpty()) return;
        notificationRepository.markAsRead(userId, ids);
    }

    @Transactional
    public void markAllAsRead(Long userId) {
        notificationRepository.markAllAsRead(userId);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private Notification buildNotification(User user, String message, String type, Instant now) {
        Notification n = new Notification();
        n.setUser(user);
        n.setMessage(message);
        n.setCreatedAt(now);
        n.setRead(false);
        n.setType(type);
        return n;
    }
}
