package com.repository;

import com.entity.Task;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.time.OffsetDateTime;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findBySubgroupId(Long subgroupId);

    // Пагинированный запрос корневых задач
    @Query("SELECT t FROM Task t WHERE t.subgroupId = :subgroupId AND (t.parentTaskId IS NULL OR t.parentTaskId = 0)")
    Page<Task> findRootTasksBySubgroupWithPagination(@Param("subgroupId") Long subgroupId, Pageable pageable);

    List<Task> findByCreatedByUserId(Long createdByUserId);

    @Query("SELECT t FROM Task t WHERE t.dueDate IS NOT NULL AND t.dueDate < :now AND t.status != 2")
    List<Task> findOverdueTasks(@Param("now") OffsetDateTime now);

    @Query("SELECT DISTINCT t FROM Task t " +
            "LEFT JOIN FETCH t.assignees " +
            "LEFT JOIN FETCH t.subgroup sg " +
            "LEFT JOIN FETCH sg.project p " +
            "WHERE t.dueDate IS NOT NULL " +
            "AND t.dueDate < :now " +
            "AND t.status != 2 " +
            "AND (t.overdueNotified IS NULL OR t.overdueNotified = false)")
    List<Task> findOverdueTasksWithDetails(@Param("now") OffsetDateTime now);

    default List<Task> findOverdueTasksWithDetails() {
        return findOverdueTasksWithDetails(OffsetDateTime.now());
    }

    @Modifying
    @Query("UPDATE Task t SET t.overdueNotified = true WHERE t.id = :taskId")
    void markOverdueNotified(@Param("taskId") Long taskId);

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

    @Query("SELECT DISTINCT t FROM Task t " +
            "JOIN t.assignees a " +
            "JOIN t.subgroup s " +
            "JOIN s.project p " +
            "WHERE a.id = :userId " +
            "AND p.id = :projectId " +
            "AND (t.parentTaskId IS NULL OR t.parentTaskId = 0)")
    List<Task> findRootTasksByAssigneeAndProject(@Param("userId") Long userId,
                                                 @Param("projectId") Long projectId);


}