package com.service;

import com.entity.*;
import com.repository.*;
import org.hibernate.Hibernate;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.util.stream.Collectors;
import java.util.HashMap;
import java.util.Map;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.scheduling.annotation.Async;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final SubgroupRepository subgroupRepository;
    private final UserRepository userRepository;
    private final AttachmentRepository attachmentRepository;
    private final EmailNotificationService emailNotificationService;
    private final TagRepository tagRepository;

    // Хранилище отложенных изменений (taskId -> PendingChanges)
    private final Map<Long, PendingChanges> pendingChanges = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(5);

    public TaskService(TaskRepository taskRepository,
                       SubgroupRepository subgroupRepository,
                       UserRepository userRepository,
                       AttachmentRepository attachmentRepository,
                       EmailNotificationService emailNotificationService,
                       TagRepository tagRepository) {
        this.taskRepository = taskRepository;
        this.subgroupRepository = subgroupRepository;
        this.userRepository = userRepository;
        this.attachmentRepository = attachmentRepository;
        this.emailNotificationService = emailNotificationService;
        this.tagRepository = tagRepository;
    }

    // Класс для хранения отложенных изменений
    private static class PendingChanges {
        final List<String> changes = Collections.synchronizedList(new ArrayList<>());
        ScheduledFuture<?> scheduledFuture = null;
        NotificationData notificationData = null;

        synchronized void addChange(String change, NotificationData data, User changedBy, Long taskId, ScheduledExecutorService scheduler, TaskService service) {
            changes.add(change);
            if (notificationData == null && data != null) {
                notificationData = data;
            }
            schedule(() -> {
                service.sendPendingChanges(taskId, changedBy);
            }, 2000, scheduler);
        }

        synchronized void schedule(Runnable task, long delayMs, ScheduledExecutorService scheduler) {
            if (scheduledFuture != null && !scheduledFuture.isDone()) {
                scheduledFuture.cancel(false);
            }
            scheduledFuture = scheduler.schedule(() -> {
                task.run();
            }, delayMs, TimeUnit.MILLISECONDS);
        }

        synchronized List<String> getChangesAndClear() {
            if (changes.isEmpty()) return null;
            List<String> result = new ArrayList<>(changes);
            changes.clear();
            return result;
        }

        synchronized NotificationData getNotificationData() {
            return notificationData;
        }
    }

    // Класс для хранения данных уведомления
    private static class NotificationData {
        final Long taskId;
        final String taskTitle;
        final String taskDescription;
        final String dueDateStr;
        final Integer priority;
        final Long projectId;
        final Long subgroupId;
        final List<AssigneeData> assignees;

        NotificationData(Task task) {
            this.taskId = task.getId();
            this.taskTitle = task.getTitle();
            this.taskDescription = task.getDescription();
            this.dueDateStr = task.getDueDate() != null ? task.getDueDate().toString() : null;
            this.priority = task.getValue();

            Subgroup subgroup = task.getSubgroup();
            if (subgroup != null) {
                this.subgroupId = subgroup.getId();
                Project project = subgroup.getProject();
                this.projectId = project != null ? project.getId() : null;
            } else {
                this.subgroupId = null;
                this.projectId = null;
            }

            this.assignees = new ArrayList<>();
            if (task.getAssignees() != null) {
                for (User assignee : task.getAssignees()) {
                    this.assignees.add(new AssigneeData(assignee.getId(), assignee.getFullName(), assignee.getEmail()));
                }
            }
        }

        Task recreateTask() {
            Task task = new Task();
            task.setId(taskId);
            task.setTitle(taskTitle);
            task.setDescription(taskDescription);
            if (dueDateStr != null) {
                task.setDueDate(OffsetDateTime.parse(dueDateStr));
            }
            task.setValue(priority);

            if (subgroupId != null) {
                Subgroup subgroup = new Subgroup();
                subgroup.setId(subgroupId);
                if (projectId != null) {
                    Project project = new Project();
                    project.setId(projectId);
                    subgroup.setProject(project);
                }
                task.setSubgroup(subgroup);
            }

            List<User> assigneeList = new ArrayList<>();
            for (AssigneeData data : assignees) {
                User user = new User();
                user.setId(data.id);
                user.setFullName(data.fullName);
                user.setEmail(data.email);
                assigneeList.add(user);
            }
            task.setAssignees(assigneeList);

            return task;
        }
    }

    private static class AssigneeData {
        final Long id;
        final String fullName;
        final String email;

        AssigneeData(Long id, String fullName, String email) {
            this.id = id;
            this.fullName = fullName;
            this.email = email;
        }
    }

    // Метод для добавления изменения с отложенной отправкой
    private void addChangeWithDelay(Long taskId, String change, User changedBy, NotificationData notificationData) {
        PendingChanges pending = pendingChanges.computeIfAbsent(taskId, k -> new PendingChanges());
        pending.addChange(change, notificationData, changedBy, taskId, scheduler, this);
    }

    private void sendPendingChanges(Long taskId, User changedBy) {
        PendingChanges pending = pendingChanges.remove(taskId);
        if (pending == null) return;

        List<String> changes = pending.getChangesAndClear();
        if (changes == null || changes.isEmpty()) return;

        NotificationData notificationData = pending.getNotificationData();

        try {
            if (changedBy != null && notificationData != null) {
                Task task = notificationData.recreateTask();
                emailNotificationService.notifyTaskUpdated(task, changedBy, changes);
                System.out.println("📧 Sent combined notification with " + changes.size() + " changes for task " + taskId);
            }
        } catch (Exception e) {
            System.err.println("Ошибка отправки уведомления: " + e.getMessage());
            e.printStackTrace();
        }
    }

    // ============ ОСНОВНЫЕ ОПЕРАЦИИ ============

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

        if (parentTaskId != null && parentTaskId > 0) {
            Task parentTask = taskRepository.findById(parentTaskId)
                    .orElseThrow(() -> new RuntimeException("Parent task not found"));
            task.setParentTask(parentTask);
            task.setParentTaskId(parentTaskId);
        } else {
            task.setParentTaskId(0L);
        }

        List<User> assignees = new ArrayList<>();
        if (assigneeIds != null && !assigneeIds.isEmpty()) {
            assignees = userRepository.findAllById(assigneeIds);
            task.getAssignees().addAll(assignees);
        }

        Task savedTask = taskRepository.save(task);

        if (!assignees.isEmpty() && (parentTaskId == null || parentTaskId == 0)) {
            emailNotificationService.notifyTaskCreated(savedTask, createdBy, assignees);
        }

        return savedTask;
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
    public Task updateTaskWithChanges(Long id, Long subgroupId, String title, String description,
                                      OffsetDateTime dueDate, Integer value, TaskStatus status,
                                      Long createdByUserId, Long parentTaskId, User updatedBy) {

        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        task.getAssignees().size();
        if (task.getSubgroup() != null) {
            task.getSubgroup().getName();
            if (task.getSubgroup().getProject() != null) {
                task.getSubgroup().getProject().getId();
            }
        }

        NotificationData notificationData = new NotificationData(task);

        List<String> changes = new ArrayList<>();

        if (title != null && !title.equals(task.getTitle())) {
            changes.add("Название: \"" + task.getTitle() + "\" → \"" + title + "\"");
        }
        if (description != null && !description.equals(task.getDescription())) {
            changes.add("Описание изменено");
        }
        if (dueDate != null && !Objects.equals(dueDate, task.getDueDate())) {
            String oldDueDate = task.getDueDate() != null ? task.getDueDate().toString() : "не указан";
            changes.add("Дедлайн: " + oldDueDate + " → " + dueDate.toString());
        }
        if (value != null && !value.equals(task.getValue())) {
            changes.add("Приоритет: " + getPriorityText(task.getValue()) + " → " + getPriorityText(value));
        }

        Task updatedTask = updateTask(id, subgroupId, title, description, dueDate, value, status, createdByUserId, parentTaskId);

        if (!changes.isEmpty() && updatedBy != null) {
            for (String change : changes) {
                addChangeWithDelay(id, change, updatedBy, notificationData);
            }
        }

        return updatedTask;
    }

    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public Task updateTaskStatus(Long id, TaskStatus newStatus, User changedBy) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        task.getAssignees().size();
        if (task.getSubgroup() != null) {
            task.getSubgroup().getName();
            if (task.getSubgroup().getProject() != null) {
                task.getSubgroup().getProject().getId();
            }
        }

        NotificationData notificationData = new NotificationData(task);

        String oldStatus = getStatusText(String.valueOf(task.getStatus()));
        String newStatusText = getStatusText(newStatus.name());

        task.setStatus(newStatus.getCode());

        Task savedTask = taskRepository.save(task);

        if (changedBy != null && !oldStatus.equals(newStatusText)) {
            addChangeWithDelay(id, "Статус: " + oldStatus + " → " + newStatusText, changedBy, notificationData);
        }

        return savedTask;
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

    @Cacheable(value = "tasksByIds", key = "#ids")
    public List<Task> findAllByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return taskRepository.findAllByIdsWithDetails(ids);
    }

    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee", "tasksByIds"}, allEntries = true)
    @Cacheable(value = "tasksBySubgroup", key = "#subgroupId")
    public List<Task> findTasksBySubgroup(Long subgroupId) {
        // 1. Загружаем задачи с исполнителями (без тегов)
        List<Task> tasks = taskRepository.findRootTasksBySubgroup(subgroupId);

        if (tasks == null || tasks.isEmpty()) {
            return tasks;
        }

        // 2. Собираем ID задач
        List<Long> taskIds = tasks.stream()
                .map(Task::getId)
                .collect(Collectors.toList());

        System.out.println("=== Loading tags for " + taskIds.size() + " tasks: " + taskIds);

        // 3. Отдельным запросом загружаем задачи с тегами
        List<Task> tasksWithTags = taskRepository.findTasksWithTagsByIds(taskIds);

        // 4. Создаем мапу taskId -> tags
        Map<Long, List<Tag>> tagsMap = new HashMap<>();
        for (Task taskWithTags : tasksWithTags) {
            // Важно: инициализируем коллекцию через Hibernate.initialize
            Hibernate.initialize(taskWithTags.getTags());
            tagsMap.put(taskWithTags.getId(), new ArrayList<>(taskWithTags.getTags()));
            System.out.println("Task " + taskWithTags.getId() + " has " + taskWithTags.getTags().size() + " tags from DB");
            for (Tag tag : taskWithTags.getTags()) {
                System.out.println("  - Tag: " + tag.getName() + " (id=" + tag.getId() + ")");
            }
        }

        // 5. Присоединяем теги к исходным задачам
        for (Task task : tasks) {
            List<Tag> tags = tagsMap.get(task.getId());
            if (tags != null && !tags.isEmpty()) {
                // Важно: инициализируем коллекцию перед очисткой
                Hibernate.initialize(task.getTags());
                task.getTags().clear();
                task.getTags().addAll(tags);
                System.out.println("Task ID: " + task.getId() + ", Tags count after merge: " + task.getTags().size());
            } else {
                System.out.println("Task ID: " + task.getId() + ", No tags found");
            }
        }

        return tasks;
    }

    @Transactional
    public Task addTagToTask(Long taskId, Long tagId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        Tag tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new RuntimeException("Tag not found"));

        // Инициализируем коллекцию тегов (это важно!)
        Hibernate.initialize(task.getTags());

        List<Tag> tags = task.getTags();
        if (!tags.stream().anyMatch(t -> t.getId().equals(tag.getId()))) {
            tags.add(tag);
        }
        Task savedTask = taskRepository.saveAndFlush(task);
        Hibernate.initialize(savedTask.getTags());
        return savedTask;
    }

    public Page<Task> findTasksBySubgroupWithPagination(Long subgroupId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return taskRepository.findRootTasksBySubgroupWithPagination(subgroupId, pageable);
    }

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

    public List<Task> findSubTasks(Long parentTaskId) {
        return taskRepository.findSubTasksByParentId(parentTaskId);
    }

    public Integer countSubTasksByParentId(Long taskId) {
        return taskRepository.countSubTasksByParentId(taskId);
    }

    public Map<Long, Integer> getSubTasksCountForTasks(List<Long> taskIds) {
        if (taskIds == null || taskIds.isEmpty()) {
            return new HashMap<>();
        }
        List<Object[]> results = taskRepository.countSubTasksByParentIds(taskIds);
        Map<Long, Integer> countMap = new HashMap<>();
        for (Object[] result : results) {
            Long parentId = (Long) result[0];
            Long count = (Long) result[1];
            countMap.put(parentId, count.intValue());
        }
        for (Long taskId : taskIds) {
            countMap.putIfAbsent(taskId, 0);
        }
        return countMap;
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
    public Task assignUserToTaskWithNotification(Long taskId, Long userId, User assignedBy) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        task.getAssignees().size();
        if (task.getSubgroup() != null) {
            task.getSubgroup().getName();
            if (task.getSubgroup().getProject() != null) {
                task.getSubgroup().getProject().getId();
            }
        }
        NotificationData notificationData = new NotificationData(task);

        if (!task.getAssignees().contains(user)) {
            task.getAssignees().add(user);
            if (assignedBy != null && !assignedBy.getId().equals(userId)) {
                addChangeWithDelay(taskId, "Добавлен исполнитель: " + user.getFullName(), assignedBy, notificationData);
            }
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

    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee", "tasksByIds"}, allEntries = true)
    @Transactional
    public Task setTaskAssigneesWithNotification(Long taskId, List<Long> userIds, User assignedBy) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        task.getAssignees().size();
        if (task.getSubgroup() != null) {
            task.getSubgroup().getName();
            if (task.getSubgroup().getProject() != null) {
                task.getSubgroup().getProject().getId();
            }
        }
        NotificationData notificationData = new NotificationData(task);

        List<User> oldAssignees = new ArrayList<>(task.getAssignees());
        List<User> newAssignees = userRepository.findAllById(userIds);

        List<User> addedAssignees = newAssignees.stream()
                .filter(newAssignee -> oldAssignees.stream().noneMatch(old -> old.getId().equals(newAssignee.getId())))
                .collect(java.util.stream.Collectors.toList());

        task.setAssignees(newAssignees);

        if (assignedBy != null) {
            for (User added : addedAssignees) {
                if (!added.getId().equals(assignedBy.getId())) {
                    addChangeWithDelay(taskId, "Добавлен исполнитель: " + added.getFullName(), assignedBy, notificationData);
                }
            }
        }

        return taskRepository.save(task);
    }

    // ============ ВЛОЖЕНИЯ ============

    @Transactional
    public Attachment addAttachment(Long taskId, MultipartFile file, User currentUser) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        task.getAssignees().size();
        if (task.getSubgroup() != null) {
            task.getSubgroup().getName();
            if (task.getSubgroup().getProject() != null) {
                task.getSubgroup().getProject().getId();
            }
        }
        NotificationData notificationData = new NotificationData(task);

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

        Attachment savedAttachment = attachmentRepository.save(attachment);

        if (currentUser != null) {
            addChangeWithDelay(taskId, "Прикреплён файл: " + file.getOriginalFilename(), currentUser, notificationData);
        }

        return savedAttachment;
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
    public void deleteAttachment(Long attachmentId, User currentUser) {
        Optional<Attachment> attachmentOpt = attachmentRepository.findById(attachmentId);
        if (attachmentOpt.isEmpty()) {
            System.err.println("Attachment not found: " + attachmentId);
            return;
        }

        Attachment attachment = attachmentOpt.get();
        Task task = attachment.getTask();
        String fileName = attachment.getFileName();

        task.getAssignees().size();
        if (task.getSubgroup() != null) {
            task.getSubgroup().getName();
            if (task.getSubgroup().getProject() != null) {
                task.getSubgroup().getProject().getId();
            }
        }
        NotificationData notificationData = new NotificationData(task);

        attachmentRepository.deleteById(attachmentId);

        if (currentUser != null) {
            addChangeWithDelay(task.getId(), "Удалён файл: " + fileName, currentUser, notificationData);
        }
    }

    @Cacheable(value = "tasksByAssignee", key = "#userId + '_' + #projectId")
    public List<Task> findTasksByAssigneeAndProject(Long userId, Long projectId) {
        return taskRepository.findRootTasksByAssigneeAndProject(userId, projectId);
    }

    public List<Attachment> getAttachmentsByTask(Long taskId) {
        return attachmentRepository.findByTaskId(taskId);
    }

    // ============ ПРОСРОЧЕННЫЕ ЗАДАЧИ ============

    @Async
    @Transactional
    public void checkOverdueTasksAndNotify() {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("🔍 Checking for overdue tasks at " + OffsetDateTime.now());

        List<Task> overdueTasks;
        try {
            overdueTasks = taskRepository.findOverdueTasksWithDetails();
        } catch (Exception e) {
            System.err.println("❌ Failed to fetch overdue tasks: " + e.getMessage());
            e.printStackTrace();
            return;
        }

        if (overdueTasks == null || overdueTasks.isEmpty()) {
            System.out.println("✅ No overdue tasks found");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        System.out.println("📋 Found " + overdueTasks.size() + " overdue tasks");

        int notificationSent = 0;
        int errors = 0;

        for (Task task : overdueTasks) {
            try {
                System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                System.out.println("📧 Processing overdue task ID: " + task.getId());
                System.out.println("   Title: " + task.getTitle());
                System.out.println("   Due date: " + task.getDueDate());

                List<User> assignees = task.getAssignees();
                if (assignees == null || assignees.isEmpty()) {
                    System.out.println("   ⏭️ Task has no assignees, skipping");
                    taskRepository.markOverdueNotified(task.getId());
                    continue;
                }

                System.out.println("   👥 Assignees: " + assignees.size());

                for (User assignee : assignees) {
                    try {
                        emailNotificationService.notifyTaskOverdue(task, assignee);
                        notificationSent++;
                        System.out.println("   ✅ Sent to: " + assignee.getEmail());
                    } catch (Exception e) {
                        System.err.println("   ❌ Failed to send to " + assignee.getEmail() + ": " + e.getMessage());
                        errors++;
                    }
                }

                taskRepository.markOverdueNotified(task.getId());
                System.out.println("   📝 Marked task as notified");

            } catch (Exception e) {
                System.err.println("❌ Error processing task " + task.getId() + ": " + e.getMessage());
                e.printStackTrace();
                errors++;
            }
        }

        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📊 Summary: " + notificationSent + " notifications sent, " + errors + " errors");
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============

    private String getPriorityText(Integer value) {
        if (value == null || value == 2) return "Средняя";
        if (value == 1) return "Низкая";
        if (value == 3) return "Высокая";
        return "Средняя";
    }

    private String getStatusText(String status) {
        if (status == null) return "Неизвестно";
        switch (status) {
            case "0": case "TODO": return "Создано";
            case "1": case "IN_PROGRESS": return "В разработке";
            case "2": case "REVIEW": return "Выполнено";
            default: return status;
        }
    }

    // ============ МАССОВОЕ НАЗНАЧЕНИЕ ТЕГОВ ДЛЯ ЗАДАЧИ ============
    @Transactional
    public void setTaskTags(Long taskId, List<Long> tagIds) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        List<Tag> tags = tagRepository.findAllById(tagIds);
        task.setTags(tags);
        taskRepository.save(task);
    }

    // ============ ДОБАВЛЕНИЕ ВЛОЖЕНИЯ ИЗ МАССИВА БАЙТ (ДЛЯ ИМПОРТА) ============
    @Transactional
    public Attachment addAttachment(Long taskId, String fileName, byte[] fileData, User currentUser) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        Attachment attachment = new Attachment();
        attachment.setFileName(fileName);
        attachment.setFileType("application/octet-stream");
        attachment.setFileSize((long) fileData.length);
        attachment.setFileData(fileData);
        attachment.setTask(task);
        Attachment saved = attachmentRepository.save(attachment);
        return saved;
    }
}