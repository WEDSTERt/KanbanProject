package com.repository;

import com.entity.Subgroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SubgroupRepository extends JpaRepository<Subgroup, Long> {

    List<Subgroup> findByProjectId(Long projectId);

    @Query("SELECT DISTINCT s FROM Subgroup s LEFT JOIN FETCH s.members WHERE s.project.id = :projectId")
    List<Subgroup> findByProjectIdWithMembers(@Param("projectId") Long projectId);
}