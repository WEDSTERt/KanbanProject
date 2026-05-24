package com.service;

import com.entity.*;
import com.repository.ProjectMemberRepository;
import com.repository.UserRepository;
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

    @Value("${app.frontend.url}")
    private String frontendUrl;

    public EmailNotificationService(JavaMailSender mailSender,
                                    UserRepository userRepository,
                                    ProjectMemberRepository projectMemberRepository) {
        this.mailSender = mailSender;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
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

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyTaskAssigned(Task task, User assignee, User assignedBy) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY TASK ASSIGNED START");
        System.out.println("Task ID: " + (task != null ? task.getId() : "null"));
        System.out.println("Assignee: " + (assignee != null ? assignee.getEmail() : "null"));
        System.out.println("Assigned by: " + (assignedBy != null ? assignedBy.getEmail() : "null"));

        if (task == null) {
            System.err.println("❌ Task is null, cannot send notification");
            return;
        }

        if (assignee == null) {
            System.err.println("❌ Assignee is null, cannot send notification");
            return;
        }

        Project project = task.getSubgroup() != null ? task.getSubgroup().getProject() : null;

        if (!isNotificationsEnabledForProject(assignee, project)) {
            System.out.println("⚠️ User " + assignee.getEmail() + " has disabled notifications for this project");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        try {
            String taskTitle = task.getTitle() != null ? task.getTitle() : "Без названия";
            String taskDescription = task.getDescription() != null ? task.getDescription() : "—";

            String dueDateStr = "—";
            if (task.getDueDate() != null) {
                dueDateStr = task.getDueDate().format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"));
                System.out.println("📅 Due date: " + dueDateStr);
            }

            String priorityText = getPriorityText(task.getValue());
            System.out.println("🏷️ Priority: " + priorityText);

            Long projectId = null;
            Long subgroupId = null;

            Subgroup subgroup = task.getSubgroup();
            if (subgroup != null) {
                subgroupId = subgroup.getId();
                System.out.println("📁 Subgroup ID: " + subgroupId);
                if (subgroup.getProject() != null) {
                    projectId = subgroup.getProject().getId();
                    System.out.println("📂 Project ID: " + projectId);
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
            System.out.println("📋 Subject: " + subject);
            sendEmail(assignee.getEmail(), subject, content);
            System.out.println("✅ Task assigned notification sent successfully");
        } catch (Exception e) {
            System.err.println("❌ Failed to send task assigned notification: " + e.getMessage());
            e.printStackTrace();
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyTaskUpdated(Task task, User updatedBy, List<String> changes) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY TASK UPDATED START");
        System.out.println("Task ID: " + (task != null ? task.getId() : "null"));
        System.out.println("Updated by: " + (updatedBy != null ? updatedBy.getEmail() : "null"));
        System.out.println("Changes count: " + (changes != null ? changes.size() : 0));

        if (changes != null && !changes.isEmpty()) {
            for (String change : changes) {
                System.out.println("  • " + change);
            }
        }

        if (task == null) {
            System.err.println("❌ Task is null, cannot send notification");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        if (task.getAssignees() == null || task.getAssignees().isEmpty()) {
            System.out.println("⚠️ Task has no assignees, skipping notification");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        Project project = task.getSubgroup() != null ? task.getSubgroup().getProject() : null;

        String changesText = changes != null ? String.join("\n- ", changes) : "Нет изменений";
        String subject = "Изменения в задаче: " + task.getTitle();

        System.out.println("👥 Assignees count: " + task.getAssignees().size());

        for (User assignee : task.getAssignees()) {
            System.out.println("→ Processing assignee: " + assignee.getEmail());

            if (!isNotificationsEnabledForProject(assignee, project)) {
                System.out.println("  ⚠️ User " + assignee.getEmail() + " has disabled notifications for this project");
                continue;
            }
            if (assignee.getId().equals(updatedBy.getId())) {
                System.out.println("  ⏭️ Skipping notifier (updatedBy): " + assignee.getEmail());
                continue;
            }

            try {
                Long projectId = null;
                Long subgroupId = null;

                Subgroup subgroup = task.getSubgroup();
                if (subgroup != null) {
                    subgroupId = subgroup.getId();
                    if (subgroup.getProject() != null) {
                        projectId = subgroup.getProject().getId();
                    }
                }

                String content = String.format(
                        "Здравствуйте, %s!\n\n" +
                                "Пользователь %s внёс изменения в задачу, где вы являетесь исполнителем:\n\n" +
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

                System.out.println("  📤 Sending email to: " + assignee.getEmail());
                sendEmail(assignee.getEmail(), subject, content);
                System.out.println("  ✅ Email sent to " + assignee.getEmail());
            } catch (Exception e) {
                System.err.println("  ❌ Failed to send to " + assignee.getEmail() + ": " + e.getMessage());
            }
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyTaskOverdue(Task task, User assignee) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY TASK OVERDUE START");
        System.out.println("Task ID: " + (task != null ? task.getId() : "null"));
        System.out.println("Assignee: " + (assignee != null ? assignee.getEmail() : "null"));

        if (task == null) {
            System.err.println("❌ Task is null, cannot send notification");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        if (assignee == null) {
            System.err.println("❌ Assignee is null, cannot send notification");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        Project project = task.getSubgroup() != null ? task.getSubgroup().getProject() : null;

        if (!isNotificationsEnabledForProject(assignee, project)) {
            System.out.println("⚠️ User " + assignee.getEmail() + " has disabled notifications for this project");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        try {
            String taskTitle = task.getTitle() != null ? task.getTitle() : "Без названия";
            String taskDescription = task.getDescription() != null ? task.getDescription() : "—";

            String dueDateStr = "—";
            if (task.getDueDate() != null) {
                dueDateStr = task.getDueDate().format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"));
                System.out.println("📅 Due date was: " + dueDateStr);
            }

            String priorityText = getPriorityText(task.getValue());
            System.out.println("🏷️ Priority: " + priorityText);

            Long projectId = null;
            Long subgroupId = null;

            Subgroup subgroup = task.getSubgroup();
            if (subgroup != null) {
                subgroupId = subgroup.getId();
                System.out.println("📁 Subgroup ID: " + subgroupId);
                if (subgroup.getProject() != null) {
                    projectId = subgroup.getProject().getId();
                    System.out.println("📂 Project ID: " + projectId);
                }
            }

            String subject = "Просрочена задача: " + taskTitle;
            String content = String.format(
                    "Здравствуйте, %s!\n\n" +
                            "У вас просрочена задача:\n\n" +
                            "Задача: %s\n" +
                            "Описание: %s\n" +
                            "Дедлайн был: %s\n" +
                            "Приоритет: %s\n\n" +
                            "Пожалуйста, обратите внимание на эту задачу.\n\n" +
                            "Перейти к задаче: %s/board?projectId=%d&subgroupId=%d&highlightTask=%d\n\n" +
                            "--\n" +
                            "Kanban Docky",
                    assignee.getFullName(),
                    taskTitle,
                    taskDescription,
                    dueDateStr,
                    priorityText,
                    frontendUrl,
                    projectId != null ? projectId : 0,
                    subgroupId != null ? subgroupId : 0,
                    task.getId()
            );

            System.out.println("📤 Sending overdue email to: " + assignee.getEmail());
            System.out.println("📋 Subject: " + subject);
            sendEmail(assignee.getEmail(), subject, content);
            System.out.println("✅ Overdue notification sent successfully");
        } catch (Exception e) {
            System.err.println("❌ Failed to send overdue notification for task " + task.getId() + " to " + assignee.getEmail() + ": " + e.getMessage());
            e.printStackTrace();
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyAttachmentAdded(Task task, User addedBy, String fileName, List<User> assignees) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY ATTACHMENT ADDED");
        System.out.println("Task ID: " + (task != null ? task.getId() : "null"));
        System.out.println("Added by: " + (addedBy != null ? addedBy.getEmail() : "null"));
        System.out.println("File name: " + fileName);
        System.out.println("Assignees count: " + (assignees != null ? assignees.size() : 0));

        if (assignees == null || assignees.isEmpty()) {
            System.out.println("⚠️ No assignees, skipping notification");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        Project project = task.getSubgroup() != null ? task.getSubgroup().getProject() : null;

        String subject = "Файл прикреплён к задаче: " + task.getTitle();

        for (User assignee : assignees) {
            System.out.println("→ Processing assignee: " + assignee.getEmail());

            if (!isNotificationsEnabledForProject(assignee, project)) {
                System.out.println("  ⚠️ User " + assignee.getEmail() + " has disabled notifications for this project");
                continue;
            }
            if (assignee.getId().equals(addedBy.getId())) {
                System.out.println("  ⏭️ Skipping notifier (addedBy): " + assignee.getEmail());
                continue;
            }

            try {
                Long projectId = null;
                Long subgroupId = null;

                Subgroup subgroup = task.getSubgroup();
                if (subgroup != null) {
                    subgroupId = subgroup.getId();
                    if (subgroup.getProject() != null) {
                        projectId = subgroup.getProject().getId();
                    }
                }

                String content = String.format(
                        "Здравствуйте, %s!\n\n" +
                                "Пользователь %s прикрепил файл к задаче, где вы являетесь исполнителем:\n\n" +
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

                System.out.println("  📤 Sending email to: " + assignee.getEmail());
                sendEmail(assignee.getEmail(), subject, content);
                System.out.println("  ✅ Email sent to " + assignee.getEmail());
            } catch (Exception e) {
                System.err.println("  ❌ Failed to send to " + assignee.getEmail() + ": " + e.getMessage());
            }
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyAttachmentDeleted(Task task, User deletedBy, String fileName, List<User> assignees) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY ATTACHMENT DELETED");
        System.out.println("Task ID: " + (task != null ? task.getId() : "null"));
        System.out.println("Deleted by: " + (deletedBy != null ? deletedBy.getEmail() : "null"));
        System.out.println("File name: " + fileName);
        System.out.println("Assignees count: " + (assignees != null ? assignees.size() : 0));

        if (assignees == null || assignees.isEmpty()) {
            System.out.println("⚠️ No assignees, skipping notification");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        Project project = task.getSubgroup() != null ? task.getSubgroup().getProject() : null;

        String subject = "Файл удалён из задачи: " + task.getTitle();

        for (User assignee : assignees) {
            System.out.println("→ Processing assignee: " + assignee.getEmail());

            if (!isNotificationsEnabledForProject(assignee, project)) {
                System.out.println("  ⚠️ User " + assignee.getEmail() + " has disabled notifications for this project");
                continue;
            }
            if (assignee.getId().equals(deletedBy.getId())) {
                System.out.println("  ⏭️ Skipping notifier (deletedBy): " + assignee.getEmail());
                continue;
            }

            try {
                Long projectId = null;
                Long subgroupId = null;

                Subgroup subgroup = task.getSubgroup();
                if (subgroup != null) {
                    subgroupId = subgroup.getId();
                    if (subgroup.getProject() != null) {
                        projectId = subgroup.getProject().getId();
                    }
                }

                String content = String.format(
                        "Здравствуйте, %s!\n\n" +
                                "Пользователь %s удалил файл из задачи, где вы являетесь исполнителем:\n\n" +
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

                System.out.println("  📤 Sending email to: " + assignee.getEmail());
                sendEmail(assignee.getEmail(), subject, content);
                System.out.println("  ✅ Email sent to " + assignee.getEmail());
            } catch (Exception e) {
                System.err.println("  ❌ Failed to send to " + assignee.getEmail() + ": " + e.getMessage());
            }
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyTaskCreated(Task task, User createdBy, List<User> assignees) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY TASK CREATED");
        System.out.println("Task ID: " + (task != null ? task.getId() : "null"));
        System.out.println("Created by: " + (createdBy != null ? createdBy.getEmail() : "null"));
        System.out.println("Assignees count: " + (assignees != null ? assignees.size() : 0));

        if (assignees == null || assignees.isEmpty()) {
            System.out.println("⚠️ No assignees, skipping notification");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        Project project = task.getSubgroup() != null ? task.getSubgroup().getProject() : null;

        String subject = "Новая задача в проекте: " + task.getTitle();

        for (User assignee : assignees) {
            System.out.println("→ Processing assignee: " + assignee.getEmail());

            if (!isNotificationsEnabledForProject(assignee, project)) {
                System.out.println("  ⚠️ User " + assignee.getEmail() + " has disabled notifications for this project");
                continue;
            }
            if (assignee.getId().equals(createdBy.getId())) {
                System.out.println("  ⏭️ Skipping creator: " + assignee.getEmail());
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

                Long projectId = null;
                Long subgroupId = null;

                Subgroup subgroup = task.getSubgroup();
                if (subgroup != null) {
                    subgroupId = subgroup.getId();
                    if (subgroup.getProject() != null) {
                        projectId = subgroup.getProject().getId();
                    }
                }

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

                System.out.println("  📤 Sending email to: " + assignee.getEmail());
                sendEmail(assignee.getEmail(), subject, content);
                System.out.println("  ✅ Email sent to " + assignee.getEmail());
            } catch (Exception e) {
                System.err.println("  ❌ Failed to send to " + assignee.getEmail() + ": " + e.getMessage());
            }
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyUserAddedToProject(Project project, User newMember, User addedBy, String role) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY USER ADDED TO PROJECT");
        System.out.println("Project: " + (project != null ? project.getName() : "null"));
        System.out.println("New member: " + (newMember != null ? newMember.getEmail() : "null"));
        System.out.println("Added by: " + (addedBy != null ? addedBy.getEmail() : "null"));
        System.out.println("Role: " + role);

        if (newMember == null) {
            System.err.println("❌ New member is null, cannot send notification");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        if (!isNotificationsEnabledForProject(newMember, project)) {
            System.out.println("⚠️ User " + newMember.getEmail() + " has disabled notifications for this project");
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

            System.out.println("📤 Sending email to: " + newMember.getEmail());
            sendEmail(newMember.getEmail(), subject, content);
            System.out.println("✅ Project added notification sent successfully");
        } catch (Exception e) {
            System.err.println("❌ Failed to send project added notification: " + e.getMessage());
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyUserAddedToSubgroup(Subgroup subgroup, User newMember, User addedBy, String role) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY USER ADDED TO SUBGROUP");
        System.out.println("Subgroup: " + (subgroup != null ? subgroup.getName() : "null"));
        System.out.println("New member: " + (newMember != null ? newMember.getEmail() : "null"));
        System.out.println("Added by: " + (addedBy != null ? addedBy.getEmail() : "null"));
        System.out.println("Role: " + role);

        if (newMember == null) {
            System.err.println("❌ New member is null, cannot send notification");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        if (subgroup == null || subgroup.getProject() == null) {
            System.err.println("❌ Subgroup or project is null, cannot check notification settings");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        if (!isNotificationsEnabledForProject(newMember, subgroup.getProject())) {
            System.out.println("⚠️ User " + newMember.getEmail() + " has disabled notifications for this project");
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

            System.out.println("📤 Sending email to: " + newMember.getEmail());
            sendEmail(newMember.getEmail(), subject, content);
            System.out.println("✅ Subgroup added notification sent successfully");
        } catch (Exception e) {
            System.err.println("❌ Failed to send subgroup added notification: " + e.getMessage());
        }
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyTaskStatusChanged(Task task, User changedBy, String oldStatus, String newStatus) {
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("📧 NOTIFY TASK STATUS CHANGED");
        System.out.println("Task ID: " + (task != null ? task.getId() : "null"));
        System.out.println("Changed by: " + (changedBy != null ? changedBy.getEmail() : "null"));
        System.out.println("Status: " + oldStatus + " → " + newStatus);

        if (task == null) {
            System.err.println("❌ Task is null, cannot send notification");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        if (task.getAssignees() == null || task.getAssignees().isEmpty()) {
            System.out.println("⚠️ Task has no assignees, skipping notification");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            return;
        }

        Project project = task.getSubgroup() != null ? task.getSubgroup().getProject() : null;

        String subject = "Статус задачи изменён: " + task.getTitle();

        for (User assignee : task.getAssignees()) {
            System.out.println("→ Processing assignee: " + assignee.getEmail());

            if (!isNotificationsEnabledForProject(assignee, project)) {
                System.out.println("  ⚠️ User " + assignee.getEmail() + " has disabled notifications for this project");
                continue;
            }
            if (assignee.getId().equals(changedBy.getId())) {
                System.out.println("  ⏭️ Skipping notifier (changedBy): " + assignee.getEmail());
                continue;
            }

            try {
                Long projectId = null;
                Long subgroupId = null;

                Subgroup subgroup = task.getSubgroup();
                if (subgroup != null) {
                    subgroupId = subgroup.getId();
                    if (subgroup.getProject() != null) {
                        projectId = subgroup.getProject().getId();
                    }
                }

                String content = String.format(
                        "Здравствуйте, %s!\n\n" +
                                "Пользователь %s изменил статус задачи, где вы являетесь исполнителем:\n\n" +
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

                System.out.println("  📤 Sending email to: " + assignee.getEmail());
                sendEmail(assignee.getEmail(), subject, content);
                System.out.println("  ✅ Email sent to " + assignee.getEmail());
            } catch (Exception e) {
                System.err.println("  ❌ Failed to send to " + assignee.getEmail() + ": " + e.getMessage());
            }
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
}