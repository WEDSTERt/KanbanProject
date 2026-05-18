package com.service;

import com.entity.*;
import com.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final SubgroupRepository subgroupRepository;
    private final UserRepository userRepository;
    private final AttachmentRepository attachmentRepository;

    public TaskService(TaskRepository taskRepository,
                       SubgroupRepository subgroupRepository,
                       UserRepository userRepository,
                       AttachmentRepository attachmentRepository) {
        this.taskRepository = taskRepository;
        this.subgroupRepository = subgroupRepository;
        this.userRepository = userRepository;
        this.attachmentRepository = attachmentRepository;
    }

    // ============ ОСНОВНЫЕ ОПЕРАЦИИ С ЗАДАЧАМИ ============

    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public Task createTask(Long subgroupId, Long createdByUserId, String title,
                           String description, OffsetDateTime dueDate, Integer value,
                           TaskStatus status, List<Long> assigneeIds, Long parentTaskId) {
        Subgroup subgroup = subgroupRepository.findById(subgroupId)
                .orElseThrow(() -> new RuntimeException("Subgroup not found"));
        User createdBy = userRepository.findById(createdByUserId)
                .orElseThrow(() -> new RuntimeException("Creator user not found"));

        Task task = new Task(title, description, subgroup, createdBy);
        task.setDueDate(dueDate);
        task.setValue(value);
        task.setStatus(status != null ? status.getCode() : TaskStatus.TODO.getCode());

        // Устанавливаем родительскую задачу, если указана
        if (parentTaskId != null && parentTaskId > 0) {
            Task parentTask = taskRepository.findById(parentTaskId)
                    .orElseThrow(() -> new RuntimeException("Parent task not found"));
            task.setParentTask(parentTask);
            task.setParentTaskId(parentTaskId);
        } else {
            task.setParentTaskId(0L);
        }

        if (assigneeIds != null && !assigneeIds.isEmpty()) {
            List<User> assignees = userRepository.findAllById(assigneeIds);
            task.getAssignees().addAll(assignees);
        }
        return taskRepository.save(task);
    }

    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public Task updateTask(Long id, Long subgroupId, String title, String description,
                           OffsetDateTime dueDate, Integer value, TaskStatus status,
                           Long createdByUserId, Long parentTaskId) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        if (subgroupId != null) {
            Subgroup subgroup = subgroupRepository.findById(subgroupId)
                    .orElseThrow(() -> new RuntimeException("Subgroup not found"));
            task.setSubgroup(subgroup);
        }
        if (title != null) task.setTitle(title);
        if (description != null) task.setDescription(description);
        if (dueDate != null) task.setDueDate(dueDate);
        if (value != null) task.setValue(value);
        if (status != null) task.setStatus(status.getCode());

        if (createdByUserId != null) {
            User createdBy = userRepository.findById(createdByUserId)
                    .orElseThrow(() -> new RuntimeException("Creator user not found"));
            task.setCreatedBy(createdBy);
            task.setCreatedByUserId(createdByUserId);
        }

        if (parentTaskId != null) {
            if (parentTaskId > 0) {
                Task parentTask = taskRepository.findById(parentTaskId)
                        .orElseThrow(() -> new RuntimeException("Parent task not found"));
                task.setParentTask(parentTask);
            } else {
                task.setParentTask(null);
                task.setParentTaskId(0L);
            }
        }

        return taskRepository.save(task);
    }

    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public boolean deleteTask(Long id) {
        if (taskRepository.existsById(id)) {
            taskRepository.deleteById(id);
            return true;
        }
        return false;
    }

    public Optional<Task> findById(Long id) {
        return taskRepository.findById(id);
    }

    // НОВЫЙ МЕТОД: поиск нескольких задач по ID с подгрузкой подзадач
    @Cacheable(value = "tasksByIds", key = "#ids")
    public List<Task> findAllByIds(List<Long> ids) {
        return taskRepository.findAllByIdsWithDetails(ids);
    }

    @Cacheable(value = "tasksBySubgroup", key = "#subgroupId")
    public List<Task> findTasksBySubgroup(Long subgroupId) {
        return taskRepository.findRootTasksBySubgroup(subgroupId);
    }

    // Получить все задачи включая подзадачи (для Ганта и фильтрации)
    public List<Task> findAllTasksBySubgroup(Long subgroupId) {
        return taskRepository.findBySubgroupId(subgroupId);
    }

    @Cacheable(value = "tasksByAssignee", key = "#userId")
    public List<Task> findTasksByAssignee(Long userId) {
        return taskRepository.findRootTasksByAssignee(userId);
    }

    public List<Task> findTasksByCreator(Long createdByUserId) {
        return taskRepository.findByCreatedByUserId(createdByUserId);
    }

    // Получить подзадачи для задачи
    public List<Task> findSubTasks(Long parentTaskId) {
        return taskRepository.findSubTasksByParentId(parentTaskId);
    }

    // ============ НАЗНАЧЕНИЕ ИСПОЛНИТЕЛЕЙ ============

    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee", "tasksByIds"}, allEntries = true)
    @Transactional
    public Task assignUserToTask(Long taskId, Long userId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (!task.getAssignees().contains(user)) {
            task.getAssignees().add(user);
        }
        return taskRepository.save(task);
    }

    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee", "tasksByIds"}, allEntries = true)
    @Transactional
    public Task unassignUserFromTask(Long taskId, Long userId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        task.getAssignees().remove(user);
        return taskRepository.save(task);
    }

    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee", "tasksByIds"}, allEntries = true)
    @Transactional
    public Task setTaskAssignees(Long taskId, List<Long> userIds) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        List<User> assignees = userRepository.findAllById(userIds);
        task.setAssignees(assignees);
        return taskRepository.save(task);
    }

    // ============ ВЛОЖЕНИЯ ============

    @Transactional
    public Attachment addAttachment(Long taskId, MultipartFile file) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        Attachment attachment = new Attachment();
        attachment.setFileName(file.getOriginalFilename());
        attachment.setFileType(file.getContentType());
        attachment.setFileSize(file.getSize());
        try {
            attachment.setFileData(file.getBytes());
        } catch (java.io.IOException e) {
            throw new RuntimeException("Failed to read file", e);
        }
        attachment.setTask(task);
        return attachmentRepository.save(attachment);
    }

    public byte[] getAttachmentContent(Long attachmentId) {
        Attachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new RuntimeException("Attachment not found"));
        return attachment.getFileData();
    }

    public Attachment getAttachmentById(Long attachmentId) {
        return attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new RuntimeException("Attachment not found"));
    }

    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee", "tasksByIds"}, allEntries = true)
    @Transactional
    public void deleteAttachment(Long attachmentId) {
        if (attachmentRepository.existsById(attachmentId)) {
            attachmentRepository.deleteById(attachmentId);
        }
    }

    public List<Attachment> getAttachmentsByTask(Long taskId) {
        return attachmentRepository.findByTaskId(taskId);
    }
}