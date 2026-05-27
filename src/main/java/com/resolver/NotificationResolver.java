package com.resolver;

import com.dto.NotificationDTO;
import com.service.NotificationService;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;

import java.util.List;

@Controller
public class NotificationResolver {

    private final NotificationService notificationService;

    public NotificationResolver(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @QueryMapping
    @PreAuthorize("isAuthenticated()")
    public List<NotificationDTO> notifications(@Argument Long userId) {
        // Проверяем, что пользователь может видеть только свои уведомления
        return notificationService.getUserNotifications(userId);
    }

    @QueryMapping
    @PreAuthorize("isAuthenticated()")
    public List<NotificationDTO> unreadNotifications(@Argument Long userId) {
        return notificationService.getUnreadNotifications(userId);
    }

    @QueryMapping
    @PreAuthorize("isAuthenticated()")
    public Integer unreadCount(@Argument Long userId) {
        return notificationService.getUnreadNotificationsCount(userId);
    }

    @MutationMapping
    @PreAuthorize("isAuthenticated()")
    public NotificationDTO markNotificationAsRead(
            @Argument Long userId,
            @Argument Long notificationId
    ) {
        return notificationService.markAsRead(notificationId, userId);
    }

    @MutationMapping
    @PreAuthorize("isAuthenticated()")
    public Boolean markAllAsRead(@Argument Long userId) {
        return notificationService.markAllAsRead(userId);
    }

    @MutationMapping
    @PreAuthorize("isAuthenticated()")
    public Boolean deleteNotification(
            @Argument Long userId,
            @Argument Long notificationId
    ) {
        return notificationService.deleteNotification(notificationId, userId);
    }

    @MutationMapping
    @PreAuthorize("isAuthenticated()")
    public Boolean deleteOldNotifications(@Argument Long userId) {
        notificationService.deleteOldNotifications();
        return true;
    }
}
