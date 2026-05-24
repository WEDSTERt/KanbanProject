package com.repository;

import com.entity.ProjectMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {
    boolean existsByProjectIdAndUserId(Long projectId, Long userId);

    Optional<ProjectMember> findByProjectIdAndUserId(Long projectId, Long userId);

    @Modifying
    @Query("UPDATE ProjectMember pm SET pm.notificationsEnabled = :enabled WHERE pm.projectId = :projectId AND pm.userId = :userId")
    void updateNotificationsEnabled(@Param("projectId") Long projectId,
                                    @Param("userId") Long userId,
                                    @Param("enabled") Boolean enabled);
}