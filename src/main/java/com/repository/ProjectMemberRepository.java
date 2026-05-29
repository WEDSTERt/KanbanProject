package com.repository;

import com.entity.ProjectMember;
import com.entity.RoleProject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {
    boolean existsByProjectIdAndUserId(Long projectId, Long userId);

    Optional<ProjectMember> findByProjectIdAndUserId(Long projectId, Long userId);
    
    // ✅ НОВОЕ: Найти всех админов в проекте (исключая одного пользователя)
    @Query("SELECT pm FROM ProjectMember pm WHERE pm.project.id = :projectId " +
           "AND pm.role = 'ADMIN' AND pm.user.id != :excludeUserId")
    List<ProjectMember> findAdminsByProjectId(@Param("projectId") Long projectId, @Param("excludeUserId") Long excludeUserId);
    
    // ✅ НОВОЕ: Найти всех членов проекта кроме одного
    @Query("SELECT pm FROM ProjectMember pm WHERE pm.project.id = :projectId AND pm.user.id != :excludeUserId")
    List<ProjectMember> findByProjectIdAndNotUserId(@Param("projectId") Long projectId, @Param("excludeUserId") Long excludeUserId);
    
    // ✅ НОВОЕ: Удалить пользователя из всех проектов
    @Modifying
    @Query("DELETE FROM ProjectMember pm WHERE pm.user.id = :userId")
    int deleteByUserId(@Param("userId") Long userId);
}
