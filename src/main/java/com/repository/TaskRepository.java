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
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findBySubgroupId(Long subgroupId);

    @Query("SELECT DISTINCT t FROM Task t " +
            "LEFT JOIN FETCH t.assignees " +
            "WHERE t.subgroupId = :subgroupId AND (t.parentTaskId IS NULL OR t.parentTaskId = 0)")
    Page<Task> findRootTasksBySubgroupWithPagination(@Param("subgroupId") Long subgroupId, Pageable pageable);

    List<Task> findByCreatedByUserId(Long createdByUserId);

    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.tags WHERE t.id = :taskId")
    Optional<Task> findByIdWithTags(@Param("taskId") Long taskId);

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

    @Query("SELECT DISTINCT t FROM Task t " +
            "LEFT JOIN FETCH t.assignees " +
            "WHERE t.subgroupId = :subgroupId AND (t.parentTaskId IS NULL OR t.parentTaskId = 0)")
    List<Task> findRootTasksBySubgroup(@Param("subgroupId") Long subgroupId);

    @Query("SELECT DISTINCT t FROM Task t " +
            "LEFT JOIN FETCH t.assignees " +
            "WHERE t.subgroupId = :subgroupId AND (t.parentTaskId IS NULL OR t.parentTaskId = 0) " +
            "ORDER BY t.createdAt DESC")
    List<Task> findRootTasksBySubgroupWithDetails(@Param("subgroupId") Long subgroupId);

    @Query("SELECT DISTINCT t FROM Task t " +
            "LEFT JOIN FETCH t.tags " +
            "WHERE t.id IN :taskIds")
    List<Task> findTasksWithTagsByIds(@Param("taskIds") List<Long> taskIds);

    @Query("SELECT t FROM Task t WHERE t.parentTaskId = :parentTaskId")
    List<Task> findSubTasksByParentId(@Param("parentTaskId") Long parentTaskId);

    @Query("SELECT DISTINCT t FROM Task t " +
            "LEFT JOIN FETCH t.assignees " +
            "LEFT JOIN FETCH t.createdBy " +
            "WHERE t.id IN :ids")
    List<Task> findAllByIdsWithDetails(@Param("ids") List<Long> ids);

    @Query("SELECT DISTINCT t FROM Task t " +
            "LEFT JOIN FETCH t.assignees a " +
            "WHERE a.id = :userId " +
            "AND (t.parentTaskId IS NULL OR t.parentTaskId = 0)")
    List<Task> findRootTasksByAssignee(@Param("userId") Long userId);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.parentTaskId = :taskId")
    Integer countSubTasksByParentId(@Param("taskId") Long taskId);

    @Query("SELECT t.parentTaskId, COUNT(t) FROM Task t WHERE t.parentTaskId IN :taskIds GROUP BY t.parentTaskId")
    List<Object[]> countSubTasksByParentIds(@Param("taskIds") List<Long> taskIds);

    @Query("SELECT DISTINCT t FROM Task t " +
            "LEFT JOIN FETCH t.assignees " +
            "WHERE t.id IN (SELECT DISTINCT t2.id FROM Task t2 " +
            "  JOIN t2.assignees a " +
            "  JOIN t2.subgroup s " +
            "  JOIN s.project p " +
            "  WHERE a.id = :userId AND p.id = :projectId) " +
            "AND (t.parentTaskId IS NULL OR t.parentTaskId = 0)")
    List<Task> findRootTasksByAssigneeAndProject(@Param("userId") Long userId,
                                                 @Param("projectId") Long projectId);

    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.subgroup sg LEFT JOIN FETCH sg.project p WHERE t.id = :taskId")
    Optional<Task> findByIdWithSubgroupAndProject(@Param("taskId") Long taskId);

    @Query("SELECT t FROM Task t WHERE t.subgroupId = :subgroupId AND t.createdByUserId = :userId")
    List<Task> findTasksInSubgroupCreatedByUser(@Param("subgroupId") Long subgroupId, 
                                                @Param("userId") Long userId);

    @Modifying
    @Query("UPDATE Task t SET t.createdByUserId = :newUserId WHERE t.subgroupId = :subgroupId AND t.createdByUserId = :oldUserId")
    int transferTasksCreatedByUser(@Param("subgroupId") Long subgroupId,
                                   @Param("oldUserId") Long oldUserId,
                                   @Param("newUserId") Long newUserId);

    @Modifying
    @Query(value = "DELETE FROM task_assignees WHERE task_id IN (SELECT id FROM tasks WHERE subgroup_id = :subgroupId) AND user_id = :userId", nativeQuery = true)
    int removeUserFromAllTaskAssignees(@Param("subgroupId") Long subgroupId,
                                       @Param("userId") Long userId);

    @Modifying
    @Query(value = "DELETE FROM task_assignees WHERE task_id IN (SELECT t.id FROM tasks t " +
            "JOIN subgroups sg ON t.subgroup_id = sg.id " +
            "WHERE sg.project_id = :projectId) AND user_id = :userId", nativeQuery = true)
    int removeUserFromAllTaskAssigneesInProject(@Param("projectId") Long projectId,
                                                @Param("userId") Long userId);
    
    // ✅ НОВОЕ: Удалить пользователя из всех задач вообще
    @Modifying
    @Query(value = "DELETE FROM task_assignees WHERE user_id = :userId", nativeQuery = true)
    int removeUserFromAllTaskAssignees(@Param("userId") Long userId);
}
