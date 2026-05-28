package com.repository;

import com.entity.Subgroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SubgroupRepository extends JpaRepository<Subgroup, Long> {

    List<Subgroup> findByProjectId(Long projectId);

    @Query("SELECT s FROM Subgroup s " +
            "LEFT JOIN FETCH s.members sm " +
            "LEFT JOIN FETCH sm.user " +
            "WHERE s.project.id = :projectId")
    List<Subgroup> findByProjectIdWithMembers(@Param("projectId") Long projectId);
    
    @Query("SELECT DISTINCT sg FROM Subgroup sg " +
            "LEFT JOIN FETCH sg.tasks t " +
            "WHERE sg.id = :id")
    Optional<Subgroup> findByIdWithTasks(@Param("id") Long id);
    
    @Query("SELECT sg FROM Subgroup sg LEFT JOIN FETCH sg.project WHERE sg.id = :id")
    Optional<Subgroup> findByIdWithProject(@Param("id") Long id);
}
