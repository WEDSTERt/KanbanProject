package com.service;

import com.controller.TaskSSEController;
import com.dto.NotificationDTO;
import com.entity.Notification;
import com.entity.User;
import com.repository.NotificationRepository;
import com.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.ApplicationContext;
import reactor.core.publisher.Sinks;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ApplicationContext applicationContext;

    // Sinks для каждого пользователя по его ID (для GraphQL subscriptions)
    private final java.util.Map<Long, Sinks.Many<NotificationDTO>> userSinks = new java.util.concurrent.ConcurrentHashMap<>();

    /**
     * Получить SSE контроллер через ApplicationContext (избегаем циклических зависимостей)
     */
    private TaskSSEController getSSEController() {
        try {
            return applicationContext.getBean(TaskSSEController.class);
        } catch (Exception e) {
            return null;
        }
    }

    public Sinks.Many<NotificationDTO> getUserSink(Long userId) {
        return userSinks.computeIfAbsent(userId, k -> Sinks.many().multicast().onBackpressureBuffer());
    }

    /**
     * Создание уведомления
     */
    @Transactional
    public NotificationDTO createNotification(Long recipientId, String type, String title, 
                                             String message, Long taskId, Long projectId) {
        System.out.println("🔔 [NotificationService] Creating notification:");
        System.out.println("   recipientId: " + recipientId);
        System.out.println("   type: " + type);
        System.out.println("   title: " + title);
        System.out.println("   projectId: " + projectId);
        
        User recipient = userRepository.findById(recipientId)
                .orElseThrow(() -> {
                    System.err.println("❌ User not found: " + recipientId);
                    return new RuntimeException("User not found: " + recipientId);
                });

        Notification notification = new Notification();
        notification.setRecipient(recipient);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setTaskId(taskId);
        notification.setProjectId(projectId);
        notification.setIsRead(false);

        System.out.println("💾 Saving notification to DB...");
        System.out.println("   recipient: " + (notification.getRecipient() != null ? notification.getRecipient().getId() : "null"));
        System.out.println("   type: " + notification.getType());
        System.out.println("   isRead: " + notification.getIsRead());
        try {
            Notification saved = notificationRepository.save(notification);
            System.out.println("✅ Notification saved! ID: " + saved.getId());
            System.out.println("   Created: " + saved.getCreatedAt());
        } catch (Exception e) {
            System.err.println("❌ Error saving notification: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
        
        Notification saved = notificationRepository.findById(notification.getId()).orElse(notification);
        NotificationDTO dto = mapToDTO(saved);
        
        // Отправляем через GraphQL subscription (для обратной совместимости)
        Sinks.Many<NotificationDTO> sink = getUserSink(recipientId);
        sink.tryEmitNext(dto);
        System.out.println("✅ Notification broadcast via GraphQL subscriptions");
        
        // 📡 Отправляем SSE событие о новом уведомлении
        try {
            TaskSSEController sseController = getSSEController();
            if (sseController != null) {
                sseController.notifyNotificationReceived(recipientId, dto);
                System.out.println("✅ Sent notification-received event to user " + recipientId);
            }
        } catch (Exception e) {
            System.err.println("Warning: Failed to send SSE notification: " + e.getMessage());
        }
        
        return dto;
    }

    /**
     * Получение всех уведомлений пользователя
     */
    public List<NotificationDTO> getUserNotifications(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return notificationRepository.findByRecipientOrderByCreatedAtDesc(user)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    /**
     * Получение непрочитанных уведомлений
     */
    public List<NotificationDTO> getUnreadNotifications(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return notificationRepository.findByRecipientAndIsReadFalseOrderByCreatedAtDesc(user)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    /**
     * Количество непрочитанных уведомлений
     */
    public Integer getUnreadNotificationsCount(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Long count = notificationRepository.countByRecipientAndIsReadFalse(user);
        return count != null ? count.intValue() : 0;
    }

    /**
     * Отметить уведомление как прочитанное
     */
    @Transactional
    public NotificationDTO markAsRead(Long notificationId, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        // Проверяем, что уведомление принадлежит пользователю
        if (!notification.getRecipient().getId().equals(userId)) {
            throw new RuntimeException("Access denied");
        }

        notification.setIsRead(true);
        notification.setReadAt(LocalDateTime.now());
        Notification updated = notificationRepository.save(notification);
        return mapToDTO(updated);
    }

    /**
     * Отметить все уведомления как прочитанные
     */
    @Transactional
    public Boolean markAllAsRead(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Notification> unread = notificationRepository.findByRecipientAndIsReadFalseOrderByCreatedAtDesc(user);
        LocalDateTime now = LocalDateTime.now();
        unread.forEach(n -> {
            n.setIsRead(true);
            n.setReadAt(now);
        });
        notificationRepository.saveAll(unread);
        return true;
    }

    /**
     * Удалить уведомление
     */
    @Transactional
    public Boolean deleteNotification(Long notificationId, Long userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        // Проверяем, что уведомление принадлежит пользователю
        if (!notification.getRecipient().getId().equals(userId)) {
            throw new RuntimeException("Access denied");
        }

        notificationRepository.deleteById(notificationId);
        return true;
    }

    /**
     * Удалить все уведомления пользователя
     */
    @Transactional
    public Boolean deleteAllNotifications(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Notification> notifications = notificationRepository.findByRecipientOrderByCreatedAtDesc(user);
        notificationRepository.deleteAll(notifications);
        return true;
    }

    /**
     * Удалить старые уведомления (старше 30 дней)
     */
    @Transactional
    public void deleteOldNotifications() {
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        notificationRepository.deleteOldNotifications(thirtyDaysAgo);
    }

    /**
     * Преобразование Notification в NotificationDTO
     */
    private NotificationDTO mapToDTO(Notification notification) {
        return new NotificationDTO(
                notification.getId(),
                notification.getType(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getTaskId(),
                notification.getProjectId(),
                notification.getIsRead(),
                notification.getCreatedAt(),
                notification.getReadAt()
        );
    }

    /**
     * Создание уведомления для нескольких пользователей
     */
    @Transactional
    public void createNotificationsForUsers(List<Long> userIds, String type, String title, 
                                           String message, Long taskId, Long projectId) {
        for (Long userId : userIds) {
            createNotification(userId, type, title, message, taskId, projectId);
        }
    }
}
