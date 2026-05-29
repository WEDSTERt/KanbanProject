package com.repository;

import com.entity.Notification;
import com.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    
    List<Notification> findByRecipientOrderByCreatedAtDesc(User recipient);
    
    List<Notification> findByRecipientAndIsReadFalseOrderByCreatedAtDesc(User recipient);
    
    Long countByRecipientAndIsReadFalse(User recipient);
    
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.createdAt < :before")
    void deleteOldNotifications(@Param("before") LocalDateTime before);
    
    // ✅ НОВОЕ: Удалить все уведомления пользователя
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.recipient.id = :userId")
    void deleteAllByUserId(@Param("userId") Long userId);
}
