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

    public NotificationService(NotificationRepository notificationRepository,
                               UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void notifyScheduleUpdate(String fileName, String uploadedBy) {
        List<User> recipients = userRepository.findAllStudentsAndTeachers();
        if (recipients.isEmpty()) return;

        String message = String.format("📅 Обновлено расписание: %s (загрузил %s)", fileName, uploadedBy);
        Instant now = Instant.now();
        List<Notification> notifications = new ArrayList<>(recipients.size());

        for (User user : recipients) {
            Notification n = new Notification();
            n.setUser(user);
            n.setMessage(message);
            n.setCreatedAt(now);
            n.setRead(false);
            n.setType("SCHEDULE_UPDATE");   // фронт ищет тип, содержащий 'SCHEDULE'
            notifications.add(n);
        }

        notificationRepository.saveAll(notifications);
    }

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
}