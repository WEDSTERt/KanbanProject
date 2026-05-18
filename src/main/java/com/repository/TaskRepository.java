package com.repository;

import com.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findBySubgroupId(Long subgroupId);

    List<Task> findByCreatedByUserId(Long createdByUserId);

    @Query("SELECT t FROM Task t JOIN t.assignees a WHERE a.id = :userId")
    List<Task> findByAssigneesId(@Param("userId") Long userId);

    // Получить только корневые задачи (parent_task_id = 0 или NULL)
    @Query("SELECT t FROM Task t WHERE t.subgroupId = :subgroupId AND (t.parentTaskId IS NULL OR t.parentTaskId = 0)")
    List<Task> findRootTasksBySubgroup(@Param("subgroupId") Long subgroupId);

    // Получить подзадачи для конкретной задачи
    @Query("SELECT t FROM Task t WHERE t.parentTaskId = :parentTaskId")
    List<Task> findSubTasksByParentId(@Param("parentTaskId") Long parentTaskId);

    // НОВЫЙ МЕТОД: поиск задач по списку ID с подгрузкой подзадач
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
}