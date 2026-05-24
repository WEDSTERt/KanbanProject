package com.repository;

import com.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByVerificationToken(String verificationToken);

    // Поиск неподтвержденных пользователей старше указанной даты
    @Query("SELECT u FROM User u WHERE (u.emailVerified = false OR u.emailVerified IS NULL) AND u.createdAt < :expiryTime")
    List<User> findUnverifiedUsersOlderThan(@Param("expiryTime") LocalDateTime expiryTime);

    // Подсчет количества неподтвержденных пользователей
    @Query("SELECT COUNT(u) FROM User u WHERE u.emailVerified = false OR u.emailVerified IS NULL")
    long countUnverifiedUsers();
}