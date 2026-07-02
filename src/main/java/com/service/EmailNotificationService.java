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
import java.util.Arrays;
import java.util.List;

@Service
public class EmailNotificationService {

    private final JavaMailSender mailSender;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TaskRepository taskRepository;
    
    @Autowired(required = false)
    private NotificationService notificationService;
    
    @Autowired(required = false)
    private TelegramNotificationService telegramNotificationService;

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
            
            // 📱 Send Telegram notification
            sendTelegramTaskAssignment(task, assignee, projectId, subgroupId, project);
        } catch (Exception e) {
            System.err.println("❌ Failed: " + e.getMessage());
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
            
            // 📱 Send Telegram notification
            if (telegramNotificationService != null) {
                telegramNotificationService.notifyProjectEvent("user_added",
                        project.getId(), project.getName(), null, null,
                        Arrays.asList(newMember.getId()));
                System.out.println("📱 Telegram notification sent for user added to project");
            }
        } catch (Exception e) {
            System.err.println("❌ Failed: " + e.getMessage());
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
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
            
            // 📱 Send Telegram notification
            if (telegramNotificationService != null) {
                telegramNotificationService.notifyProjectEvent("user_removed",
                        project.getId(), project.getName(), null, null,
                        Arrays.asList(removedMember.getId()));
                System.out.println("📱 Telegram notification sent for user removed from project");
            }
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
            
            // 📱 Send Telegram notification
            if (telegramNotificationService != null) {
                telegramNotificationService.notifyGroupEvent("user_added",
                        subgroup.getProject().getId(), subgroup.getProject().getName(),
                        subgroup.getId(), subgroup.getName(), null,
                        Arrays.asList(newMember.getId()));
                System.out.println("📱 Telegram notification sent for user added to subgroup");
            }
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
            
            // 📱 Send Telegram notification
            if (telegramNotificationService != null) {
                telegramNotificationService.notifyGroupEvent("user_removed",
                        subgroup.getProject().getId(), subgroup.getProject().getName(),
                        subgroup.getId(), subgroup.getName(), null,
                        Arrays.asList(removedMember.getId()));
                System.out.println("📱 Telegram notification sent for user removed from subgroup");
            }
        } catch (Exception e) {
            System.err.println("❌ Failed: " + e.getMessage());
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    // ============ MISSING METHODS ADDED BELOW ============
// Добавьте эти методы в EmailNotificationService.java после метода notifyTaskAssigned()

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
            
            // 📱 Send Telegram notification
            if (telegramNotificationService != null) {
                telegramNotificationService.notifyTaskEvent("updated",
                        projectId, project != null ? project.getName() : "Unknown",
                        subgroupId, subgroup != null ? subgroup.getName() : "Unknown",
                        task.getId(), task.getTitle(), null,
                        null, null, null, null,
                        Arrays.asList(assignee.getId()), changesText);
            }
        } catch (Exception e) {
            System.err.println("  ❌ Failed: " + e.getMessage());
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
            
            // 📱 Send Telegram notification
            if (telegramNotificationService != null) {
                telegramNotificationService.notifyTaskEvent("created",
                        projectId, project != null ? project.getName() : "Unknown",
                        subgroupId, subgroup != null ? subgroup.getName() : "Unknown",
                        task.getId(), task.getTitle(), priorityText,
                        null, null, null, null,
                        Arrays.asList(assignee.getId()), null);
            }
        } catch (Exception e) {
            System.err.println("❌ Failed: " + e.getMessage());
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
        
        // 📱 Send Telegram notification
        if (telegramNotificationService != null) {
            telegramNotificationService.notifyTaskEvent("overdue",
                    projectId, project != null ? project.getName() : "Unknown",
                    subgroupId, subgroup != null ? subgroup.getName() : "Unknown",
                    task.getId(), taskTitle, null,
                    null, null, dueDateStr, null,
                    Arrays.asList(assignee.getId()), null);
        }
    } catch (Exception e) {
        System.err.println("❌ Failed: " + e.getMessage());
    }
    System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

    // ============ END OF MISSING METHODS ============
    private void sendTelegramTaskAssignment(Task task, User assignee, Long projectId, Long subgroupId, Project project) {
        if (telegramNotificationService != null) {
            try {
                telegramNotificationService.notifyTaskEvent("assigned",
                        projectId, project != null ? project.getName() : "Unknown",
                        subgroupId, task.getSubgroup() != null ? task.getSubgroup().getName() : "Unknown",
                        task.getId(), task.getTitle(), getPriorityText(task.getValue()),
                        null, null, null, null,
                        Arrays.asList(assignee.getId()), null);
                System.out.println("📱 Telegram notification sent for task assigned");
            } catch (Exception e) {
                System.err.println("⚠️ Failed to send Telegram notification: " + e.getMessage());
            }
        }
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

    public void sendEmailForAddedToSubgroup(String email, String memberName, String subgroupName,
                                           String projectName, String role, String addedByName,
                                           Long projectId, Long subgroupId) {
        try {
            String subject = "Вас добавили в группу: " + subgroupName;
            String link = String.format("%s/board?projectId=%d&subgroupId=%d", frontendUrl, projectId, subgroupId);
            String content = String.format(
                    "Здравствуйте, %s!\n\n" +
                            "Пользователь %s добавил вас в группу \"%s\" проекта \"%s\" в роли \"%s\".\n\n" +
                            "Перейти к группе: %s\n\n" +
                            "--\n" +
                            "Kanban Docky",
                    memberName,
                    addedByName,
                    subgroupName,
                    projectName,
                    role.equals("LEADER") ? "Лидер группы" : "Участник группы",
                    link
            );
            System.out.println("📤 Sending email to: " + email);
            sendEmail(email, subject, content);
            System.out.println("✅ Email sent successfully");
        } catch (Exception e) {
            System.err.println("❌ Failed to send email: " + e.getMessage());
        }
    }

    public void sendEmailForRemovedFromSubgroup(String email, String memberName, String subgroupName,
                                               String projectName) {
        try {
            String subject = "Вас удалили из группы: " + subgroupName;
            String content = String.format(
                    "Здравствуйте, %s!\n\n" +
                            "Вас удалили из группы \"%s\" проекта \"%s\".\n\n" +
                            "Если это произошло по ошибке, свяжитесь с администратором проекта.\n\n" +
                            "--\n" +
                            "Kanban Docky",
                    memberName,
                    subgroupName,
                    projectName
            );
            System.out.println("📤 Sending email to: " + email);
            sendEmail(email, subject, content);
            System.out.println("✅ Email sent successfully");
        } catch (Exception e) {
            System.err.println("❌ Failed to send email: " + e.getMessage());
        }
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyUserRemovedFromSubgroupWithData(String email, String memberName, String subgroupName,
                                                      String projectName, Long projectId, Long subgroupId, Long userId) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY USER REMOVED FROM SUBGROUP");

        try {
            String subject = "Вас удалили из группы: " + subgroupName;
            String content = String.format(
                    "Здравствуйте, %s!\n\n" +
                            "Вас удалили из группы \"%s\" проекта \"%s\".\n\n" +
                            "Если это произошло по ошибке, свяжитесь с администратором проекта.\n\n" +
                            "--\n" +
                            "Kanban Docky",
                    memberName,
                    subgroupName,
                    projectName
            );

            System.out.println("📤 Sending email");
            sendEmail(email, subject, content);
            System.out.println("✅ Email sent");
            
            // 🔔 Create in-app notification
            createInAppNotification(userId,
                    "user_removed_from_subgroup",
                    "Вас удалили из группы",
                    "Вас удалили из группы \"" + subgroupName + "\"",
                    null,
                    projectId);
            
            // 📱 Send Telegram notification
            if (telegramNotificationService != null) {
                telegramNotificationService.notifyGroupEvent("user_removed",
                        projectId, projectName,
                        subgroupId, subgroupName, null,
                        java.util.Arrays.asList(userId));
                System.out.println("📱 Telegram notification sent for user removed from subgroup");
            }
        } catch (Exception e) {
            System.err.println("❌ Failed: " + e.getMessage());
            e.printStackTrace();
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    /**
     * 📧 Отправить уведомление об удалении задачи
     */
    public void notifyTaskDeleted(Task task, User assignee) {
        if (assignee == null || task == null) return;

        try {
            String subject = "Задача удалена: " + task.getTitle();
            String content = String.format(
                    "Здравствуйте, %s!%n%n" +
                    "Задача, в которой вы были исполнителем, была удалена:%n" +
                    "Задача: \"%s\"%n" +
                    "Описание: %s%n%n" +
                    "Если у вас есть вопросы, свяжитесь с администратором проекта.%n%n" +
                    "--%n" +
                    "Kanban Docky",
                    assignee.getFullName(),
                    task.getTitle(),
                    task.getDescription() != null ? task.getDescription() : "Нет описания"
            );

            System.out.println("📧 Sending task deleted email to: " + assignee.getEmail());
            sendEmail(assignee.getEmail(), subject, content);
            System.out.println("✅ Task deleted email sent successfully");
            
            // 📱 Отправляем Telegram уведомление
            if (telegramNotificationService != null) {
                Long projectId = task.getSubgroup() != null && task.getSubgroup().getProject() != null 
                    ? task.getSubgroup().getProject().getId() 
                    : null;
                Long subgroupId = task.getSubgroup() != null ? task.getSubgroup().getId() : null;
                
                if (projectId != null && subgroupId != null) {
                    telegramNotificationService.notifyTaskEvent("deleted",
                        projectId,
                        task.getSubgroup().getProject().getName(),
                        subgroupId,
                        task.getSubgroup().getName(),
                        task.getId(),
                        task.getTitle(),
                        null, null, null, null, null,
                        java.util.Arrays.asList(assignee.getId()), null);
                    System.out.println("📱 Telegram notification sent for task deleted");
                }
            }
        } catch (Exception e) {
            System.err.println("❌ Failed to send task deleted email: " + e.getMessage());
        }
    }

    /**
     * 📧 Отправить уведомление об удалении пользователя из исполнителей задачи
     */
    public void notifyUserRemovedFromTask(Task task, User removedUser, User removedBy) {
        if (removedUser == null || task == null) return;

        try {
            String subject = "Вы удалены из исполнителей задачи: " + task.getTitle();
            String content = String.format(
                    "Здравствуйте, %s!%n%n" +
                    "Пользователь %s удалил вас из исполнителей задачи:%n" +
                    "Задача: \"%s\"%n" +
                    "Описание: %s%n%n" +
                    "Если у вас есть вопросы, свяжитесь с администратором проекта.%n%n" +
                    "--%n" +
                    "Kanban Docky",
                    removedUser.getFullName(),
                    removedBy.getFullName(),
                    task.getTitle(),
                    task.getDescription() != null ? task.getDescription() : "Нет описания"
            );

            System.out.println("📧 Sending user removed from task email to: " + removedUser.getEmail());
            sendEmail(removedUser.getEmail(), subject, content);
            System.out.println("✅ User removed from task email sent successfully");
            
            // 📱 Отправляем Telegram уведомление
            if (telegramNotificationService != null) {
                Long projectId = task.getSubgroup() != null && task.getSubgroup().getProject() != null 
                    ? task.getSubgroup().getProject().getId() 
                    : null;
                Long subgroupId = task.getSubgroup() != null ? task.getSubgroup().getId() : null;
                
                if (projectId != null && subgroupId != null) {
                    telegramNotificationService.notifyTaskEvent("updated",
                        projectId,
                        task.getSubgroup().getProject().getName(),
                        subgroupId,
                        task.getSubgroup().getName(),
                        task.getId(),
                        task.getTitle(),
                        null, null, null, null, null,
                        java.util.Arrays.asList(removedUser.getId()),
                        "Удалён исполнитель: " + removedUser.getFullName());
                    System.out.println("📱 Telegram notification sent for user removed from task");
                }
            }
        } catch (Exception e) {
            System.err.println("❌ Failed to send user removed from task email: " + e.getMessage());
        }
    }
}


