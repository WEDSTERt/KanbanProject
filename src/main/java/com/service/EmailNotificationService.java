package com.service;

import com.entity.*;
import com.repository.ProjectMemberRepository;
import com.repository.TaskRepository;
import com.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class EmailNotificationService {

    private final JavaMailSender mailSender;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TaskRepository taskRepository;
    
    @Autowired(required = false)
    private NotificationService notificationService;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    public EmailNotificationService(JavaMailSender mailSender,
                                    UserRepository userRepository,
                                    ProjectMemberRepository projectMemberRepository,
                                    TaskRepository taskRepository) {
        this.mailSender = mailSender;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.taskRepository = taskRepository;
        System.out.println("📧 EmailNotificationService initialized");
    }

    private boolean isNotificationsEnabled(User user) {
        if (user == null) {
            System.out.println("⚠️ User is null, cannot check notifications");
            return false;
        }
        boolean enabled = user.getEmailNotificationsEnabled() == null || user.getEmailNotificationsEnabled();
        System.out.println("🔔 User " + user.getEmail() + " global notifications enabled: " + enabled);
        return enabled;
    }

    private boolean isNotificationsEnabledForProject(User user, Project project) {
        if (user == null || project == null) return true;

        // Проверяем глобальные настройки пользователя
        if (!isNotificationsEnabled(user)) {
            System.out.println("🔔 Global notifications disabled for user: " + user.getEmail());
            return false;
        }

        // Проверяем настройки для конкретного проекта
        try {
            ProjectMember member = projectMemberRepository.findByProjectIdAndUserId(project.getId(), user.getId()).orElse(null);
            if (member != null && member.getNotificationsEnabled() != null && !member.getNotificationsEnabled()) {
                System.out.println("🔔 Project notifications disabled for user: " + user.getEmail() + " in project: " + project.getName());
                return false;
            }
        } catch (Exception e) {
            System.err.println("Failed to check project notifications: " + e.getMessage());
        }

        return true;
    }

    private boolean isTaskCompleted(Task task) {
        if (task == null) return false;
        Integer status = task.getStatus();
        return status != null && status == 2;
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyTaskAssigned(Task task, User assignee, User assignedBy) {
        if (isTaskCompleted(task)) {
            System.out.println("⚠️ Task " + task.getId() + " is completed, skipping assignment notification");
            return;
        }

        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY TASK ASSIGNED START");
        System.out.println("Task ID: " + (task != null ? task.getId() : "null"));
        System.out.println("Assignee: " + (assignee != null ? assignee.getEmail() : "null"));
        System.out.println("Assigned by: " + (assignedBy != null ? assignedBy.getEmail() : "null"));

        if (task == null || assignee == null) {
            System.err.println("❌ Task or assignee is null");
            return;
        }

        Project project = task.getSubgroup() != null ? task.getSubgroup().getProject() : null;

        if (!isNotificationsEnabledForProject(assignee, project)) {
            System.out.println("⚠️ User " + assignee.getEmail() + " has disabled notifications");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        try {
            String taskTitle = task.getTitle() != null ? task.getTitle() : "Без названия";
            String taskDescription = task.getDescription() != null ? task.getDescription() : "—";

            String dueDateStr = "—";
            if (task.getDueDate() != null) {
                dueDateStr = task.getDueDate().format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"));
            }

            String priorityText = getPriorityText(task.getValue());

            Long projectId = null;
            Long subgroupId = null;

            Subgroup subgroup = task.getSubgroup();
            if (subgroup != null) {
                subgroupId = subgroup.getId();
                if (subgroup.getProject() != null) {
                    projectId = subgroup.getProject().getId();
                }
            }

            String subject = "Вам назначена задача: " + taskTitle;
            String content = String.format(
                    "Здравствуйте, %s!\n\n" +
                            "Пользователь %s назначил вас исполнителем задачи:\n\n" +
                            "Задача: %s\n" +
                            "Описание: %s\n" +
                            "Дедлайн: %s\n" +
                            "Приоритет: %s\n\n" +
                            "Перейти к задаче: %s/board?projectId=%d&subgroupId=%d&highlightTask=%d\n\n" +
                            "--\n" +
                            "Kanban Docky",
                    assignee.getFullName(),
                    assignedBy != null ? assignedBy.getFullName() : "Система",
                    taskTitle,
                    taskDescription,
                    dueDateStr,
                    priorityText,
                    frontendUrl,
                    projectId != null ? projectId : 0,
                    subgroupId != null ? subgroupId : 0,
                    task.getId()
            );

            System.out.println("📤 Sending email to: " + assignee.getEmail());
            sendEmail(assignee.getEmail(), subject, content);
            System.out.println("✅ Email sent to " + assignee.getEmail());
            
            // 🔔 Create in-app notification
            createInAppNotification(assignee.getId(), "task_assigned", 
                    "Вам назначена задача: " + taskTitle,
                    "Пользователь " + (assignedBy != null ? assignedBy.getFullName() : "Система") + " назначил вас исполнителем",
                    task.getId(), projectId);
        } catch (Exception e) {
            System.err.println("❌ Failed: " + e.getMessage());
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyTaskUpdated(Task task, User updatedBy, List<String> changes) {
        if (task != null && task.getId() != null) {
            Task reloaded = taskRepository.findByIdWithSubgroupAndProject(task.getId()).orElse(task);
            if (reloaded != null) {
                task = reloaded;
            }
        }
        
        if (isTaskCompleted(task)) {
            System.out.println("⚠️ Task " + task.getId() + " is completed, skipping update notification");
            return;
        }

        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY TASK UPDATED START");
        System.out.println("Task ID: " + (task != null ? task.getId() : "null"));
        System.out.println("Changes count: " + (changes != null ? changes.size() : 0));

        if (changes != null && !changes.isEmpty()) {
            for (String change : changes) {
                System.out.println("  • " + change);
            }
        }

        if (task == null || task.getAssignees() == null || task.getAssignees().isEmpty()) {
            System.out.println("⚠️ Task has no assignees, skipping");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        Project project = task.getSubgroup() != null ? task.getSubgroup().getProject() : null;
        String changesText = changes != null ? String.join("\n- ", changes) : "Нет изменений";
        String subject = "Изменения в задаче: " + task.getTitle();

        Long projectId = null;
        Long subgroupId = null;
        Subgroup subgroup = task.getSubgroup();
        if (subgroup != null) {
            subgroupId = subgroup.getId();
            if (subgroup.getProject() != null) {
                projectId = subgroup.getProject().getId();
            }
        }

        System.out.println("👥 Assignees count: " + task.getAssignees().size());

        for (User assignee : task.getAssignees()) {
            System.out.println("→ Processing assignee: " + assignee.getEmail());

            if (!isNotificationsEnabledForProject(assignee, project)) {
                System.out.println("  ⚠️ Notifications disabled");
                continue;
            }
            if (assignee.getId().equals(updatedBy.getId())) {
                System.out.println("  ⏭️ Skipping self");
                continue;
            }

            try {
                String content = String.format(
                        "Здравствуйте, %s!\n\n" +
                                "Пользователь %s внёс изменения в задачу:\n\n" +
                                "Задача: %s\n" +
                                "Изменения:\n- %s\n\n" +
                                "Перейти к задаче: %s/board?projectId=%d&subgroupId=%d&highlightTask=%d\n\n" +
                                "--\n" +
                                "Kanban Docky",
                        assignee.getFullName(),
                        updatedBy != null ? updatedBy.getFullName() : "Система",
                        task.getTitle(),
                        changesText,
                        frontendUrl,
                        projectId != null ? projectId : 0,
                        subgroupId != null ? subgroupId : 0,
                        task.getId()
                );

                System.out.println("  📤 Sending email");
                sendEmail(assignee.getEmail(), subject, content);
                System.out.println("  ✅ Email sent");
                
                // 🔔 Create in-app notification
                createInAppNotification(assignee.getId(), "task_updated",
                        "Изменения в задаче: " + task.getTitle(),
                        changesText,
                        task.getId(), projectId);
            } catch (Exception e) {
                System.err.println("  ❌ Failed: " + e.getMessage());
            }
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyTaskOverdue(Task task, User assignee) {
        if (isTaskCompleted(task)) {
            System.out.println("⚠️ Task completed, skipping");
            return;
        }

        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY TASK OVERDUE");

        if (task == null || assignee == null) {
            System.err.println("❌ Task or assignee is null");
            return;
        }

        Project project = task.getSubgroup() != null ? task.getSubgroup().getProject() : null;

        if (!isNotificationsEnabledForProject(assignee, project)) {
            System.out.println("⚠️ Notifications disabled");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        try {
            String taskTitle = task.getTitle() != null ? task.getTitle() : "Без названия";
            String taskDescription = task.getDescription() != null ? task.getDescription() : "—";

            String dueDateStr = "—";
            if (task.getDueDate() != null) {
                dueDateStr = task.getDueDate().format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"));
            }

            Long projectId = null;
            Long subgroupId = null;

            Subgroup subgroup = task.getSubgroup();
            if (subgroup != null) {
                subgroupId = subgroup.getId();
                if (subgroup.getProject() != null) {
                    projectId = subgroup.getProject().getId();
                }
            }

            String subject = "Просрочена задача: " + taskTitle;
            String content = String.format(
                    "Здравствуйте, %s!\n\n" +
                            "У вас просрочена задача:\n\n" +
                            "Задача: %s\n" +
                            "Описание: %s\n" +
                            "Дедлайн был: %s\n\n" +
                            "Пожалуйста, обратите внимание на эту задачу.\n\n" +
                            "Перейти к задаче: %s/board?projectId=%d&subgroupId=%d&highlightTask=%d\n\n" +
                            "--\n" +
                            "Kanban Docky",
                    assignee.getFullName(),
                    taskTitle,
                    taskDescription,
                    dueDateStr,
                    frontendUrl,
                    projectId != null ? projectId : 0,
                    subgroupId != null ? subgroupId : 0,
                    task.getId()
            );

            System.out.println("📤 Sending email");
            sendEmail(assignee.getEmail(), subject, content);
            System.out.println("✅ Email sent");
            
            // 🔔 Create in-app notification
            createInAppNotification(assignee.getId(), "task_overdue",
                    "Просрочена задача: " + taskTitle,
                    "Дедлайн был: " + dueDateStr,
                    task.getId(), projectId);
        } catch (Exception e) {
            System.err.println("❌ Failed: " + e.getMessage());
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyAttachmentAdded(Task task, User addedBy, String fileName, List<User> assignees) {
        if (isTaskCompleted(task)) {
            System.out.println("⚠️ Task completed, skipping");
            return;
        }

        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY ATTACHMENT ADDED");

        if (assignees == null || assignees.isEmpty()) {
            System.out.println("⚠️ No assignees, skipping");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        Project project = task.getSubgroup() != null ? task.getSubgroup().getProject() : null;
        String subject = "Файл прикреплён к задаче: " + task.getTitle();

        Long projectId = null;
        Long subgroupId = null;
        Subgroup subgroup = task.getSubgroup();
        if (subgroup != null) {
            subgroupId = subgroup.getId();
            if (subgroup.getProject() != null) {
                projectId = subgroup.getProject().getId();
            }
        }

        for (User assignee : assignees) {
            if (!isNotificationsEnabledForProject(assignee, project)) {
                continue;
            }
            if (assignee.getId().equals(addedBy.getId())) {
                continue;
            }

            try {
                String content = String.format(
                        "Здравствуйте, %s!\n\n" +
                                "Пользователь %s прикрепил файл к задаче:\n\n" +
                                "Задача: %s\n" +
                                "Файл: %s\n\n" +
                                "Перейти к задаче: %s/board?projectId=%d&subgroupId=%d&highlightTask=%d\n\n" +
                                "--\n" +
                                "Kanban Docky",
                        assignee.getFullName(),
                        addedBy != null ? addedBy.getFullName() : "Система",
                        task.getTitle(),
                        fileName,
                        frontendUrl,
                        projectId != null ? projectId : 0,
                        subgroupId != null ? subgroupId : 0,
                        task.getId()
                );

                sendEmail(assignee.getEmail(), subject, content);
                
                // 🔔 Create in-app notification
                createInAppNotification(assignee.getId(), "attachment_added",
                        "Файл прикреплён: " + fileName,
                        "К задаче " + task.getTitle() + " прикреплён файл: " + fileName,
                        task.getId(), projectId);
            } catch (Exception e) {
                System.err.println("❌ Failed: " + e.getMessage());
            }
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyAttachmentDeleted(Task task, User deletedBy, String fileName, List<User> assignees) {
        if (isTaskCompleted(task)) {
            System.out.println("⚠️ Task completed, skipping");
            return;
        }

        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY ATTACHMENT DELETED");

        if (assignees == null || assignees.isEmpty()) {
            System.out.println("⚠️ No assignees");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        Project project = task.getSubgroup() != null ? task.getSubgroup().getProject() : null;
        String subject = "Файл удалён из задачи: " + task.getTitle();

        Long projectId = null;
        Long subgroupId = null;
        Subgroup subgroup = task.getSubgroup();
        if (subgroup != null) {
            subgroupId = subgroup.getId();
            if (subgroup.getProject() != null) {
                projectId = subgroup.getProject().getId();
            }
        }

        for (User assignee : assignees) {
            if (!isNotificationsEnabledForProject(assignee, project)) {
                continue;
            }
            if (assignee.getId().equals(deletedBy.getId())) {
                continue;
            }

            try {
                String content = String.format(
                        "Здравствуйте, %s!\n\n" +
                                "Пользователь %s удалил файл из задачи:\n\n" +
                                "Задача: %s\n" +
                                "Файл: %s\n\n" +
                                "Перейти к задаче: %s/board?projectId=%d&subgroupId=%d&highlightTask=%d\n\n" +
                                "--\n" +
                                "Kanban Docky",
                        assignee.getFullName(),
                        deletedBy != null ? deletedBy.getFullName() : "Система",
                        task.getTitle(),
                        fileName,
                        frontendUrl,
                        projectId != null ? projectId : 0,
                        subgroupId != null ? subgroupId : 0,
                        task.getId()
                );

                sendEmail(assignee.getEmail(), subject, content);
                
                // 🔔 Create in-app notification
                createInAppNotification(assignee.getId(), "attachment_deleted",
                        "Файл удалён: " + fileName,
                        "Из задачи " + task.getTitle() + " удалён файл: " + fileName,
                        task.getId(), projectId);
            } catch (Exception e) {
                System.err.println("❌ Failed: " + e.getMessage());
            }
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyTaskCreated(Task task, User createdBy, List<User> assignees) {
        if (isTaskCompleted(task)) {
            System.out.println("⚠️ Task completed, skipping");
            return;
        }

        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY TASK CREATED");

        if (assignees == null || assignees.isEmpty()) {
            System.out.println("⚠️ No assignees");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        Project project = task.getSubgroup() != null ? task.getSubgroup().getProject() : null;
        String subject = "Новая задача: " + task.getTitle();

        Long projectId = null;
        Long subgroupId = null;
        Subgroup subgroup = task.getSubgroup();
        if (subgroup != null) {
            subgroupId = subgroup.getId();
            if (subgroup.getProject() != null) {
                projectId = subgroup.getProject().getId();
            }
        }

        for (User assignee : assignees) {
            if (!isNotificationsEnabledForProject(assignee, project)) {
                continue;
            }
            if (assignee.getId().equals(createdBy.getId())) {
                continue;
            }

            try {
                String taskTitle = task.getTitle() != null ? task.getTitle() : "Без названия";
                String taskDescription = task.getDescription() != null ? task.getDescription() : "—";

                String dueDateStr = "—";
                if (task.getDueDate() != null) {
                    dueDateStr = task.getDueDate().format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"));
                }

                String priorityText = getPriorityText(task.getValue());

                String content = String.format(
                        "Здравствуйте, %s!\n\n" +
                                "Пользователь %s создал новую задачу и назначил вас исполнителем:\n\n" +
                                "Задача: %s\n" +
                                "Описание: %s\n" +
                                "Дедлайн: %s\n" +
                                "Приоритет: %s\n\n" +
                                "Перейти к задаче: %s/board?projectId=%d&subgroupId=%d&highlightTask=%d\n\n" +
                                "--\n" +
                                "Kanban Docky",
                        assignee.getFullName(),
                        createdBy != null ? createdBy.getFullName() : "Система",
                        taskTitle,
                        taskDescription,
                        dueDateStr,
                        priorityText,
                        frontendUrl,
                        projectId != null ? projectId : 0,
                        subgroupId != null ? subgroupId : 0,
                        task.getId()
                );

                sendEmail(assignee.getEmail(), subject, content);
                
                // 🔔 Create in-app notification
                createInAppNotification(assignee.getId(), "task_created",
                        "Новая задача: " + taskTitle,
                        taskDescription,
                        task.getId(), projectId);
            } catch (Exception e) {
                System.err.println("❌ Failed: " + e.getMessage());
            }
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyTaskStatusChanged(Task task, User changedBy, String oldStatus, String newStatus) {
        if (isTaskCompleted(task)) {
            System.out.println("⚠️ Task completed, skipping");
            return;
        }

        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY TASK STATUS CHANGED");

        if (task == null || task.getAssignees() == null || task.getAssignees().isEmpty()) {
            System.out.println("⚠️ Task has no assignees");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        Project project = task.getSubgroup() != null ? task.getSubgroup().getProject() : null;
        String subject = "Статус задачи изменён: " + task.getTitle();

        Long projectId = null;
        Long subgroupId = null;
        Subgroup subgroup = task.getSubgroup();
        if (subgroup != null) {
            subgroupId = subgroup.getId();
            if (subgroup.getProject() != null) {
                projectId = subgroup.getProject().getId();
            }
        }

        for (User assignee : task.getAssignees()) {
            if (!isNotificationsEnabledForProject(assignee, project)) {
                continue;
            }
            if (assignee.getId().equals(changedBy.getId())) {
                continue;
            }

            try {
                String content = String.format(
                        "Здравствуйте, %s!\n\n" +
                                "Пользователь %s изменил статус задачи:\n\n" +
                                "Задача: %s\n" +
                                "Статус: %s -> %s\n\n" +
                                "Перейти к задаче: %s/board?projectId=%d&subgroupId=%d&highlightTask=%d\n\n" +
                                "--\n" +
                                "Kanban Docky",
                        assignee.getFullName(),
                        changedBy != null ? changedBy.getFullName() : "Система",
                        task.getTitle(),
                        getStatusText(oldStatus),
                        getStatusText(newStatus),
                        frontendUrl,
                        projectId != null ? projectId : 0,
                        subgroupId != null ? subgroupId : 0,
                        task.getId()
                );

                sendEmail(assignee.getEmail(), subject, content);
                
                // 🔔 Create in-app notification
                createInAppNotification(assignee.getId(), "task_status_changed",
                        "Статус задачи изменён: " + task.getTitle(),
                        "Статус: " + getStatusText(oldStatus) + " -> " + getStatusText(newStatus),
                        task.getId(), projectId);
            } catch (Exception e) {
                System.err.println("❌ Failed: " + e.getMessage());
            }
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyUserAddedToProject(Project project, User newMember, User addedBy, String role) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY USER ADDED TO PROJECT");

        if (newMember == null) {
            System.err.println("❌ New member is null");
            return;
        }

        if (!isNotificationsEnabledForProject(newMember, project)) {
            System.out.println("⚠️ Notifications disabled");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        try {
            String subject = "Вас добавили в проект: " + project.getName();
            String content = String.format(
                    "Здравствуйте, %s!\n\n" +
                            "Пользователь %s добавил вас в проект \"%s\" в роли \"%s\".\n\n" +
                            "Перейти к проекту: %s/board?projectId=%d&subgroupId=my-tasks\n\n" +
                            "--\n" +
                            "Kanban Docky",
                    newMember.getFullName(),
                    addedBy != null ? addedBy.getFullName() : "Система",
                    project.getName(),
                    getRoleText(role),
                    frontendUrl,
                    project.getId()
            );

            System.out.println("📤 Sending email");
            sendEmail(newMember.getEmail(), subject, content);
            System.out.println("✅ Email sent");
            
            // 🔔 Create in-app notification
            createInAppNotification(newMember.getId(), "user_added_to_project",
                    "Вас добавили в проект",
                    "Вас добавили в проект " + project.getName(),
                    null, project.getId());
        } catch (Exception e) {
            System.err.println("❌ Failed: " + e.getMessage());
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyUserAddedToSubgroup(Subgroup subgroup, User newMember, User addedBy, String role) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY USER ADDED TO SUBGROUP");

        if (newMember == null || subgroup == null || subgroup.getProject() == null) {
            System.err.println("❌ Invalid input");
            return;
        }

        if (!isNotificationsEnabledForProject(newMember, subgroup.getProject())) {
            System.out.println("⚠️ Notifications disabled");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        try {
            String subject = "Вас добавили в группу: " + subgroup.getName();
            String content = String.format(
                    "Здравствуйте, %s!\n\n" +
                            "Пользователь %s добавил вас в группу \"%s\" проекта \"%s\" в роли \"%s\".\n\n" +
                            "Перейти к проекту: %s/board?projectId=%d&subgroupId=%d\n\n" +
                            "--\n" +
                            "Kanban Docky",
                    newMember.getFullName(),
                    addedBy != null ? addedBy.getFullName() : "Система",
                    subgroup.getName(),
                    subgroup.getProject().getName(),
                    role.equals("LEADER") ? "Лидер группы" : "Участник группы",
                    frontendUrl,
                    subgroup.getProject().getId(),
                    subgroup.getId()
            );

            System.out.println("📤 Sending email");
            sendEmail(newMember.getEmail(), subject, content);
            System.out.println("✅ Email sent");
            
            // 🔔 Create in-app notification
            createInAppNotification(newMember.getId(),
                    "user_added_to_subgroup",
                    "Вас добавили в группу",
                    "Пользователь " + (addedBy != null ? addedBy.getFullName() : "Система") + " добавил вас в группу \"" + subgroup.getName() + "\"",
                    null,
                    subgroup.getProject().getId());
        } catch (Exception e) {
            System.err.println("❌ Failed: " + e.getMessage());
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    private void sendEmail(String to, String subject, String text) {
        try {
            System.out.println("  ✉️ Sending...");
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setSubject(subject);
            message.setText(text);
            mailSender.send(message);
            System.out.println("  ✅ Email sent successfully to: " + to);
        } catch (Exception e) {
            System.err.println("  ❌ Failed to send email to: " + to);
            System.err.println("  ❌ Error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void createInAppNotification(Long userId, String type, String title, String message, Long taskId, Long projectId) {
        if (notificationService != null) {
            try {
                notificationService.createNotification(userId, type, title, message, taskId, projectId);
            } catch (Exception e) {
                System.err.println("⚠️ Failed to create in-app notification: " + e.getMessage());
            }
        }
    }

    private String getPriorityText(Integer value) {
        if (value == null || value == 2) return "Средняя";
        if (value == 1) return "Низкая";
        if (value == 3) return "Высокая";
        return "Средняя";
    }

    private String getStatusText(String status) {
        if (status == null) return "Неизвестно";
        switch (status) {
            case "TODO": return "Создано";
            case "IN_PROGRESS": return "В разработке";
            case "REVIEW": return "Выполнено";
            default: return status;
        }
    }

    private String getRoleText(String role) {
        if (role == null) return "Участник";
        switch (role) {
            case "OWNER": return "Владелец";
            case "ADMIN": return "Администратор";
            case "MEMBER": return "Участник";
            case "VIEWER": return "Наблюдатель";
            default: return role;
        }
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyUserRemovedFromProject(Project project, User removedMember) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY USER REMOVED FROM PROJECT");

        if (removedMember == null) {
            System.err.println("❌ Removed member is null");
            return;
        }

        if (!isNotificationsEnabledForProject(removedMember, project)) {
            System.out.println("⚠️ Notifications disabled");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        try {
            String subject = "Вас удалили из проекта: " + project.getName();
            String content = String.format(
                    "Здравствуйте, %s!\n\n" +
                            "Вас удалили из проекта \"%s\".\n\n" +
                            "Если это произошло по ошибке, свяжитесь с администратором проекта.\n\n" +
                            "--\n" +
                            "Kanban Docky",
                    removedMember.getFullName(),
                    project.getName()
            );

            System.out.println("📤 Sending email");
            sendEmail(removedMember.getEmail(), subject, content);
            System.out.println("✅ Email sent");
            
            // 🔔 Create in-app notification
            createInAppNotification(removedMember.getId(), "user_removed_from_project",
                    "Вас удалили из проекта",
                    "Вас удалили из проекта " + project.getName(),
                    null, project.getId());
        } catch (Exception e) {
            System.err.println("❌ Failed: " + e.getMessage());
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyUserRemovedFromSubgroup(Subgroup subgroup, User removedMember) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY USER REMOVED FROM SUBGROUP");

        if (removedMember == null || subgroup == null || subgroup.getProject() == null) {
            System.err.println("❌ Invalid input");
            return;
        }

        if (!isNotificationsEnabledForProject(removedMember, subgroup.getProject())) {
            System.out.println("⚠️ Notifications disabled");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        try {
            String subject = "Вас удалили из группы: " + subgroup.getName();
            String content = String.format(
                    "Здравствуйте, %s!\n\n" +
                            "Вас удалили из группы \"%s\" проекта \"%s\".\n\n" +
                            "Если это произошло по ошибке, свяжитесь с администратором проекта.\n\n" +
                            "--\n" +
                            "Kanban Docky",
                    removedMember.getFullName(),
                    subgroup.getName(),
                    subgroup.getProject().getName()
            );

            System.out.println("📤 Sending email");
            sendEmail(removedMember.getEmail(), subject, content);
            System.out.println("✅ Email sent");
            
            // 🔔 Create in-app notification
            createInAppNotification(removedMember.getId(),
                    "user_removed_from_subgroup",
                    "Вас удалили из группы",
                    "Вас удалили из группы \"" + subgroup.getName() + "\"",
                    null,
                    subgroup.getProject().getId());
        } catch (Exception e) {
            System.err.println("❌ Failed: " + e.getMessage());
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
}
