package com.controller;

import com.config.JwtUtil;
import com.entity.*;
import com.service.*;
import org.springframework.data.domain.Page;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.graphql.data.method.annotation.SchemaMapping;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import org.hibernate.Hibernate;

import java.time.OffsetDateTime;
import java.util.List;

@Controller
public class GraphQLController {

    private final UserService userService;
    private final ProjectService projectService;
    private final SubgroupService subgroupService;
    private final TaskService taskService;
    private final JwtUtil jwtUtil;
    private final TagService tagService;
    private final NotificationService notificationService;

    public GraphQLController(UserService userService,
                             ProjectService projectService,
                             SubgroupService subgroupService,
                             TaskService taskService,
                             JwtUtil jwtUtil,
                             TagService tagService, NotificationService notificationService) {
        this.userService = userService;
        this.projectService = projectService;
        this.subgroupService = subgroupService;
        this.taskService = taskService;
        this.jwtUtil = jwtUtil;
        this.tagService = tagService;
        this.notificationService = notificationService;
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof UserDetails userDetails) {
            Long userId = Long.parseLong(userDetails.getUsername());
            return userService.findById(userId).orElse(null);
        }
        return null;
    }

    // ---------- QUERY ----------
    @QueryMapping
    public User user(@Argument Long id) {
        return userService.findById(id).orElse(null);
    }

    @QueryMapping
    public List<User> users(@Argument Integer limit, @Argument Integer offset) {
        return userService.findAll(limit, offset);
    }

    @QueryMapping
    public Project project(@Argument Long id) {
        return projectService.findById(id).orElse(null);
    }

    @QueryMapping
    public List<Project> projectsByOwner(@Argument Long ownerUserId) {
        return projectService.findProjectsByOwner(ownerUserId);
    }

    @QueryMapping
    public List<Project> projectsByMember(@Argument Long userId) {
        return projectService.findProjectsByMember(userId);
    }

    @QueryMapping
    public Subgroup subgroup(@Argument Long id) {
        return subgroupService.findById(id).orElse(null);
    }

    @QueryMapping
    public List<Subgroup> subgroupsByProject(@Argument Long projectId) {
        return subgroupService.findSubgroupsByProject(projectId);
    }

    @QueryMapping
    public Task task(@Argument Long id) {
        return taskService.findById(id).orElse(null);
    }

    @QueryMapping
    @Transactional(readOnly = true)
    public List<Task> tasksByIds(@Argument List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        List<Task> tasks = taskService.findAllByIds(ids);
        for (Task task : tasks) {
            Hibernate.initialize(task.getTags());
        }
        return tasks;
    }

    @QueryMapping
    @Transactional(readOnly = true)
    public List<Task> tasksBySubgroup(@Argument Long subgroupId) {
        List<Task> tasks = taskService.findTasksBySubgroup(subgroupId);
        for (Task task : tasks) {
            Hibernate.initialize(task.getTags());
        }
        return tasks;
    }

    @QueryMapping
    @Transactional(readOnly = true)
    public List<Task> tasksByAssignee(@Argument Long userId) {
        List<Task> tasks = taskService.findTasksByAssignee(userId);
        for (Task task : tasks) {
            Hibernate.initialize(task.getTags());
        }
        return tasks;
    }

    @QueryMapping
    public List<Task> tasksByCreator(@Argument Long createdByUserId) {
        return taskService.findTasksByCreator(createdByUserId);
    }

    @QueryMapping
    public List<Attachment> taskAttachments(@Argument Long taskId) {
        return taskService.getAttachmentsByTask(taskId);
    }

    @QueryMapping
    public List<Task> taskSubTasks(@Argument Long taskId) {
        return taskService.findSubTasks(taskId);
    }

    @QueryMapping
    public User me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof UserDetails userDetails) {
            Long userId = Long.parseLong(userDetails.getUsername());
            return userService.findById(userId).orElse(null);
        }
        return null;
    }

    // ============ TAG QUERIES ============
    @QueryMapping
    public List<Tag> tags(@Argument Long projectId) {
        return tagService.getTagsByProject(projectId);
    }

    // ---------- MUTATION ----------
    @MutationMapping
    public AuthPayload createUser(@Argument String fullName,
                                  @Argument String email,
                                  @Argument String password,
                                  @Argument String turnstileToken,
                                  @Argument String clientIp) {

        String ip = (clientIp != null && !clientIp.isEmpty()) ? clientIp : "0.0.0.0";

        User user = userService.createUser(fullName, email, password, turnstileToken, ip);
        String token = jwtUtil.generateToken(user.getId(), user.getEmail());

        return new AuthPayload(token, user);
    }

    @MutationMapping
    public Boolean verifyEmail(@Argument String token) {
        return userService.verifyEmail(token);
    }

    @MutationMapping
    public Boolean resendVerificationEmail(@Argument String email) {
        userService.resendVerificationEmail(email);
        return true;
    }

    @MutationMapping
    public AuthPayload login(@Argument String email, @Argument String password) {
        User user = userService.login(email, password);
        if (user == null) {
            throw new RuntimeException("Invalid email or password");
        }
        String token = jwtUtil.generateToken(user.getId(), user.getEmail());
        return new AuthPayload(token, user);
    }

    @MutationMapping
    public User updateUser(@Argument Long id,
                           @Argument String fullName,
                           @Argument String email,
                           @Argument String password) {
        return userService.updateUser(id, fullName, email, password);
    }

    @MutationMapping
    public boolean deleteUser(@Argument Long id) {
        return userService.deleteUser(id);
    }

    @MutationMapping
    public User updateEmailNotifications(@Argument Boolean emailNotificationsEnabled) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("User not authenticated");
        }
        return userService.updateEmailNotifications(currentUser.getId(), emailNotificationsEnabled);
    }

    @MutationMapping
    public Project createProject(@Argument String name,
                                 @Argument Long ownerUserId) {
        return projectService.createProject(name, ownerUserId);
    }

    @MutationMapping
    public Project updateProject(@Argument Long id,
                                 @Argument String name) {
        return projectService.updateProject(id, name);
    }

    @MutationMapping
    public boolean deleteProject(@Argument Long id) {
        return projectService.deleteProject(id);
    }

    @MutationMapping
    public ProjectMember addProjectMember(@Argument Long projectId,
                                          @Argument Long userId,
                                          @Argument RoleProject role) {
        User currentUser = getCurrentUser();
        return projectService.addProjectMemberWithNotification(projectId, userId, role, currentUser);
    }

    @MutationMapping
    public ProjectMember updateProjectMember(@Argument Long id,
                                             @Argument RoleProject role) {
        return projectService.updateProjectMember(id, role);
    }

    @MutationMapping
    public boolean removeProjectMember(@Argument Long id) {
        return projectService.removeProjectMember(id);
    }

    @MutationMapping
    public ProjectMember updateProjectNotifications(@Argument Long projectId, @Argument Boolean notificationsEnabled) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("User not authenticated");
        }
        return projectService.updateProjectNotifications(projectId, currentUser.getId(), notificationsEnabled);
    }

    @MutationMapping
    public Subgroup createSubgroup(@Argument Long projectId,
                                   @Argument String name,
                                   @Argument Long creatorUserId) {
        return subgroupService.createSubgroup(projectId, name, creatorUserId);
    }

    @MutationMapping
    public Subgroup updateSubgroup(@Argument Long id,
                                   @Argument String name) {
        return subgroupService.updateSubgroup(id, name);
    }

    @MutationMapping
    public boolean deleteSubgroup(@Argument Long id) {
        return subgroupService.deleteSubgroup(id);
    }

    @MutationMapping
    public SubgroupMember addSubgroupMember(@Argument Long subgroupId,
                                            @Argument Long userId,
                                            @Argument RoleSubgroup role) {
        User currentUser = getCurrentUser();
        return subgroupService.addSubgroupMemberWithNotification(subgroupId, userId, role, currentUser);
    }

    @MutationMapping
    public SubgroupMember updateSubgroupMember(@Argument Long id,
                                               @Argument RoleSubgroup role) {
        return subgroupService.updateSubgroupMember(id, role);
    }

    @MutationMapping
    public boolean removeSubgroupMember(@Argument Long id) {
        return subgroupService.removeSubgroupMember(id);
    }

    @MutationMapping
    public Task createTask(@Argument Long subgroupId,
                           @Argument Long createdByUserId,
                           @Argument String title,
                           @Argument String description,
                           @Argument OffsetDateTime dueDate,
                           @Argument Integer value,
                           @Argument TaskStatus status,
                           @Argument List<Long> assigneeIds,
                           @Argument Long parentTaskId) {
        return taskService.createTask(subgroupId, createdByUserId, title,
                description, dueDate, value, status, assigneeIds, parentTaskId);
    }

    @MutationMapping
    public Task updateTask(@Argument Long id,
                           @Argument Long subgroupId,
                           @Argument String title,
                           @Argument String description,
                           @Argument OffsetDateTime dueDate,
                           @Argument Integer value,
                           @Argument TaskStatus status,
                           @Argument Long createdByUserId,
                           @Argument Long parentTaskId) {
        User currentUser = getCurrentUser();
        return taskService.updateTaskWithChanges(id, subgroupId, title, description,
                dueDate, value, status, createdByUserId, parentTaskId, currentUser);
    }

    @MutationMapping
    public boolean deleteTask(@Argument Long id) {
        return taskService.deleteTask(id);
    }

    @MutationMapping
    public Task assignUserToTask(@Argument Long taskId,
                                 @Argument Long userId) {
        User currentUser = getCurrentUser();
        return taskService.assignUserToTaskWithNotification(taskId, userId, currentUser);
    }

    @MutationMapping
    public Task unassignUserFromTask(@Argument Long taskId,
                                     @Argument Long userId) {
        return taskService.unassignUserFromTask(taskId, userId);
    }

    @MutationMapping
    public Task setTaskAssignees(@Argument Long taskId,
                                 @Argument List<Long> userIds) {
        User currentUser = getCurrentUser();
        return taskService.setTaskAssigneesWithNotification(taskId, userIds, currentUser);
    }

    // ============ TAG MUTATIONS ============
    @MutationMapping
    public Tag createTag(@Argument Long projectId, @Argument String name, @Argument String color) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("User not authenticated");
        }
        return tagService.createTag(projectId, name, color);
    }

    @MutationMapping
    public Tag updateTag(@Argument Long id, @Argument String name, @Argument String color) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("User not authenticated");
        }
        return tagService.updateTag(id, name, color);
    }

    @MutationMapping
    public Boolean deleteTag(@Argument Long id) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("User not authenticated");
        }
        tagService.deleteTag(id);
        return true;
    }

    @MutationMapping
    public Task addTagToTask(@Argument Long taskId, @Argument Long tagId) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("User not authenticated");
        }
        return tagService.addTagToTask(taskId, tagId);
    }

    @MutationMapping
    public Task addMultipleTagsToTask(@Argument Long taskId, @Argument List<Long> tagIds) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("User not authenticated");
        }
        return tagService.addMultipleTagsToTask(taskId, tagIds);
    }

    @MutationMapping
    public Task removeTagFromTask(@Argument Long taskId, @Argument Long tagId) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("User not authenticated");
        }
        return tagService.removeTagFromTask(taskId, tagId);
    }

    @MutationMapping
    public Task setTaskTags(@Argument Long taskId, @Argument List<Long> tagIds) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("User not authenticated");
        }
        return tagService.setTaskTags(taskId, tagIds);
    }

    @MutationMapping
    public Boolean deleteTagFromProject(@Argument Long tagId, @Argument Long projectId) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            throw new RuntimeException("User not authenticated");
        }
        Project project = projectService.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        ProjectMember member = project.getMembers().stream()
                .filter(m -> m.getUserId().equals(currentUser.getId()))
                .findFirst()
                .orElse(null);

        if (member == null || (member.getRole() != RoleProject.OWNER && member.getRole() != RoleProject.ADMIN)) {
            throw new RuntimeException("You don't have permission to delete tags in this project");
        }

        tagService.deleteTag(tagId);
        return true;
    }

    // ============ SCHEMA MAPPINGS ============

    @SchemaMapping(typeName = "User", field = "ownedProjects")
    public List<Project> ownedProjects(User user) {
        return projectService.findProjectsByOwner(user.getId());
    }

    @SchemaMapping(typeName = "User", field = "projectMemberships")
    public List<ProjectMember> projectMemberships(User user) {
        return user.getProjectMemberships();
    }

    @SchemaMapping(typeName = "User", field = "subgroupMemberships")
    public List<SubgroupMember> subgroupMemberships(User user) {
        return user.getSubgroupMemberships();
    }

    @SchemaMapping(typeName = "User", field = "createdTasks")
    public List<Task> createdTasks(User user) {
        return taskService.findTasksByCreator(user.getId());
    }

    @SchemaMapping(typeName = "User", field = "assignedTasks")
    @Transactional(readOnly = true)
    public List<Task> assignedTasks(User user) {
        List<Task> tasks = taskService.findTasksByAssignee(user.getId());
        for (Task task : tasks) {
            Hibernate.initialize(task.getTags());
        }
        return tasks;
    }

    @SchemaMapping(typeName = "Project", field = "owner")
    public User projectOwner(Project project) {
        return project.getOwner();
    }

    @SchemaMapping(typeName = "Project", field = "members")
    public List<ProjectMember> projectMembers(Project project) {
        return project.getMembers();
    }

    @SchemaMapping(typeName = "Project", field = "subgroups")
    public List<Subgroup> projectSubgroups(Project project) {
        return subgroupService.findSubgroupsByProject(project.getId());
    }

    @SchemaMapping(typeName = "ProjectMember", field = "project")
    public Project memberProject(ProjectMember pm) {
        return pm.getProject();
    }

    @SchemaMapping(typeName = "ProjectMember", field = "user")
    public User memberUser(ProjectMember pm) {
        return pm.getUser();
    }

    @SchemaMapping(typeName = "ProjectMember", field = "notificationsEnabled")
    public Boolean projectMemberNotificationsEnabled(ProjectMember pm) {
        return pm.getNotificationsEnabled();
    }

    @SchemaMapping(typeName = "Subgroup", field = "project")
    public Project subgroupProject(Subgroup subgroup) {
        return subgroup.getProject();
    }

    @SchemaMapping(typeName = "Subgroup", field = "members")
    public List<SubgroupMember> subgroupMembers(Subgroup subgroup) {
        return subgroup.getMembers();
    }

    @SchemaMapping(typeName = "Subgroup", field = "tasks")
    @Transactional(readOnly = true)
    public List<Task> subgroupTasks(Subgroup subgroup) {
        List<Task> tasks = taskService.findTasksBySubgroup(subgroup.getId());
        for (Task task : tasks) {
            Hibernate.initialize(task.getTags());
        }
        return tasks;
    }

    @SchemaMapping(typeName = "SubgroupMember", field = "subgroup")
    public Subgroup memberSubgroup(SubgroupMember sm) {
        return sm.getSubgroup();
    }

    @SchemaMapping(typeName = "SubgroupMember", field = "user")
    public User subgroupMemberUser(SubgroupMember sm) {
        return sm.getUser();
    }

    @SchemaMapping(typeName = "Task", field = "subgroup")
    public Subgroup taskSubgroup(Task task) {
        return task.getSubgroup();
    }

    @SchemaMapping(typeName = "Task", field = "createdBy")
    public User taskCreatedBy(Task task) {
        return task.getCreatedBy();
    }

    @SchemaMapping(typeName = "Task", field = "assignees")
    public List<User> taskAssignees(Task task) {
        return task.getAssignees();
    }

    @SchemaMapping(typeName = "Task", field = "status")
    public Integer taskStatus(Task task) {
        return task.getStatus();
    }

    @SchemaMapping(typeName = "Task", field = "attachments")
    public List<Attachment> taskAttachmentsResolver(Task task) {
        return task.getAttachments();
    }

    @SchemaMapping(typeName = "Task", field = "parentTask")
    public Task taskParentTask(Task task) {
        return task.getParentTask();
    }

    @SchemaMapping(typeName = "Task", field = "subTasksCount")
    public Integer taskSubTasksCount(Task task) {
        return taskService.countSubTasksByParentId(task.getId());
    }

    @SchemaMapping(typeName = "Task", field = "subTasks")
    public List<Task> taskSubTasksResolver(Task task) {
        return taskService.findSubTasks(task.getId());
    }

    @SchemaMapping(typeName = "Task", field = "tags")
    public List<Tag> taskTags(Task task) {
        Hibernate.initialize(task.getTags());
        return task.getTags();
    }

    @QueryMapping
    public Page<Task> tasksBySubgroupPaginated(@Argument Long subgroupId,
                                               @Argument int page,
                                               @Argument int size) {
        return taskService.findTasksBySubgroupWithPagination(subgroupId, page, size);
    }

    @QueryMapping
    @Transactional(readOnly = true)
    public List<Task> tasksByAssigneeAndProject(@Argument Long userId, @Argument Long projectId) {
        List<Task> tasks = taskService.findTasksByAssigneeAndProject(userId, projectId);
        // Инициализируем теги для всех задач перед сериализацией
        for (Task task : tasks) {
            Hibernate.initialize(task.getTags());
        }
        return tasks;
    }
}

