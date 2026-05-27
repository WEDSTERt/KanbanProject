package com.repository;

import com.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {

    List<Project> findByOwnerUserId(Long ownerUserId);

    @Query("SELECT p FROM Project p JOIN p.members pm WHERE pm.userId = :userId")
    List<Project> findProjectsByMemberUserId(@Param("userId") Long userId);

    @Query("SELECT DISTINCT p FROM Project p " +
            "LEFT JOIN FETCH p.subgroups sg " +
            "WHERE p.id = :id")
    Optional<Project> findByIdWithDetails(@Param("id") Long id);

    @Query("SELECT DISTINCT sg FROM Subgroup sg " +
            "LEFT JOIN FETCH sg.tasks t " +
            "WHERE sg.project.id = :projectId")
    List<com.entity.Subgroup> findSubgroupsWithTasksByProjectId(@Param("projectId") Long projectId);
}
