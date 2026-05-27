package com.repository;

import com.entity.ProjectMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {
    boolean existsByProjectIdAndUserId(Long projectId, Long userId);

    Optional<ProjectMember> findByProjectIdAndUserId(Long projectId, Long userId);
}