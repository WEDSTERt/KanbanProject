package com.repository;

import com.entity.Task;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findBySubgroupId(Long subgroupId);

    // Пагинированный запрос корневых задач
    @Query("SELECT t FROM Task t WHERE t.subgroupId = :subgroupId AND (t.parentTaskId IS NULL OR t.parentTaskId = 0)")
    Page<Task> findRootTasksBySubgroupWithPagination(@Param("subgroupId") Long subgroupId, Pageable pageable);

    List<Task> findByCreatedByUserId(Long createdByUserId);

    @Query("SELECT t FROM Task t JOIN t.assignees a WHERE a.id = :userId")
    List<Task> findByAssigneesId(@Param("userId") Long userId);

    @Query("SELECT t FROM Task t WHERE t.subgroupId = :subgroupId AND (t.parentTaskId IS NULL OR t.parentTaskId = 0)")
    List<Task> findRootTasksBySubgroup(@Param("subgroupId") Long subgroupId);

    @Query("SELECT t FROM Task t WHERE t.parentTaskId = :parentTaskId")
    List<Task> findSubTasksByParentId(@Param("parentTaskId") Long parentTaskId);

    @Query("SELECT DISTINCT t FROM Task t " +
            "LEFT JOIN FETCH t.assignees " +
            "LEFT JOIN FETCH t.createdBy " +
            "WHERE t.id IN :ids")
    List<Task> findAllByIdsWithDetails(@Param("ids") List<Long> ids);

    @Query("SELECT DISTINCT t FROM Task t " +
            "JOIN t.assignees a " +
            "WHERE a.id = :userId " +
            "AND (t.parentTaskId IS NULL OR t.parentTaskId = 0)")
    List<Task> findRootTasksByAssignee(@Param("userId") Long userId);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.parentTaskId = :taskId")
    Integer countSubTasksByParentId(@Param("taskId") Long taskId);

    @Query("SELECT t.parentTaskId, COUNT(t) FROM Task t WHERE t.parentTaskId IN :taskIds GROUP BY t.parentTaskId")
    List<Object[]> countSubTasksByParentIds(@Param("taskIds") List<Long> taskIds);
}