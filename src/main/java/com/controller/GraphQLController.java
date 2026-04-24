package com.controller;

import com.entity.*;
import com.repository.UserRepository;
import com.service.*;
import com.config.JwtUtil;
import org.springframework.graphql.data.method.annotation.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.web.multipart.MultipartFile;
import java.time.OffsetDateTime;
import java.util.List;

@Controller
public class GraphQLController {

    private final UserService userService;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
//    private final ProjectService projectService;
//    private final SubgroupService subgroupService;
//    private final TaskService taskService;

    public GraphQLController(UserService userService,
//                             ProjectService projectService,
//                             SubgroupService subgroupService,
//                             TaskService taskService,
                             UserRepository userRepository,
                             PasswordEncoder passwordEncoder,
                             JwtUtil jwtUtil) {
        this.userService = userService;
//        this.projectService = projectService;
//        this.subgroupService = subgroupService;
//        this.taskService = taskService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
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

    //@QueryMapping
    //public Project project(@Argument Long id) {
    //    return projectService.findById(id).orElse(null);
    //}

    //@QueryMapping
    //public List<Project> projectsByOwner(@Argument Long ownerUserId) {
    //    return projectService.findProjectsByOwner(ownerUserId);
    //}

    //@QueryMapping
    //public List<Project> projectsByMember(@Argument Long userId) {
    //    return projectService.findProjectsByMember(userId);
    //}

    //@QueryMapping
    //public Subgroup subgroup(@Argument Long id) {
    //    return subgroupService.findById(id).orElse(null);
    //}

    //@QueryMapping
    //public List<Subgroup> subgroupsByProject(@Argument Long projectId) {
    //    return subgroupService.findSubgroupsByProject(projectId);
    //}

    //@QueryMapping
    //public Task task(@Argument Long id) {
    //    return taskService.findById(id).orElse(null);
    //}

    //@QueryMapping
    //public List<Task> tasksBySubgroup(@Argument Long subgroupId) {
    //    return taskService.findTasksBySubgroup(subgroupId);
    //}

    //@QueryMapping
    //public List<Task> tasksByAssignee(@Argument Long userId) {
    //    return taskService.findTasksByAssignee(userId);
    //}

    //@QueryMapping
    //public List<Task> tasksByCreator(@Argument Long createdByUserId) {
    //    return taskService.findTasksByCreator(createdByUserId);
    //}

    //@QueryMapping
    //public List<Attachment> taskAttachments(@Argument Long taskId) {
    //    return taskService.getAttachmentsByTask(taskId);
    //}

    @QueryMapping
    public User me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) auth.getPrincipal();
            Long userId = Long.parseLong(userDetails.getUsername());
            return userService.findById(userId).orElse(null);
        }
        return null;
    }

    // ---------- MUTATION ----------
    @MutationMapping
    public AuthPayload createUser(@Argument String fullName,
                                  @Argument String email,
                                  @Argument String password) {
        User user = userService.createUser(fullName, email, password);
        String token = jwtUtil.generateToken(user.getId(), user.getEmail());
        return new AuthPayload(token, user);
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

//    @MutationMapping
//    public Project createProject(@Argument String name,
//                                 @Argument Long ownerUserId) {
//        return projectService.createProject(name, ownerUserId);
//    }
//
//    @MutationMapping
//    public Project updateProject(@Argument Long id,
//                                 @Argument String name) {
//        return projectService.updateProject(id, name);
//    }
//
//    @MutationMapping
//    public boolean deleteProject(@Argument Long id) {
//        return projectService.deleteProject(id);
//    }
//
//    @MutationMapping
//    public ProjectMember addProjectMember(@Argument Long projectId,
//                                          @Argument Long userId,
//                                          @Argument RoleProject role) {
//        return projectService.addProjectMember(projectId, userId, role);
//    }
//
//    @MutationMapping
//    public ProjectMember updateProjectMember(@Argument Long id,
//                                             @Argument RoleProject role) {
//        return projectService.updateProjectMember(id, role);
//    }
//
//    @MutationMapping
//    public boolean removeProjectMember(@Argument Long id) {
//        return projectService.removeProjectMember(id);
//    }
//
//    @MutationMapping
//    public Subgroup createSubgroup(@Argument Long projectId,
//                                   @Argument String name,
//                                   @Argument Long creatorUserId) {
//        return subgroupService.createSubgroup(projectId, name, creatorUserId);
//    }
//
//    @MutationMapping
//    public Subgroup updateSubgroup(@Argument Long id,
//                                   @Argument String name) {
//        return subgroupService.updateSubgroup(id, name);
//    }
//
//    @MutationMapping
//    public boolean deleteSubgroup(@Argument Long id) {
//        return subgroupService.deleteSubgroup(id);
//    }
//
//    @MutationMapping
//    public SubgroupMember addSubgroupMember(@Argument Long subgroupId,
//                                            @Argument Long userId,
//                                            @Argument RoleSubgroup role) {
//        return subgroupService.addSubgroupMember(subgroupId, userId, role);
//    }
//
//    @MutationMapping
//    public SubgroupMember updateSubgroupMember(@Argument Long id,
//                                               @Argument RoleSubgroup role) {
//        return subgroupService.updateSubgroupMember(id, role);
//    }
//
//    @MutationMapping
//    public boolean removeSubgroupMember(@Argument Long id) {
//        return subgroupService.removeSubgroupMember(id);
//    }
//
//    @MutationMapping
//    public Task createTask(@Argument Long subgroupId,
//                           @Argument Long createdByUserId,
//                           @Argument String title,
//                           @Argument String description,
//                           @Argument OffsetDateTime dueDate,
//                           @Argument Integer value,
//                           @Argument TaskStatus status,
//                           @Argument List<Long> assigneeIds) {
//        return taskService.createTask(subgroupId, createdByUserId, title,
//                description, dueDate, value, status, assigneeIds);
//    }
//
//    @MutationMapping
//    public Task updateTask(@Argument Long id,
//                           @Argument Long subgroupId,
//                           @Argument String title,
//                           @Argument String description,
//                           @Argument OffsetDateTime dueDate,
//                           @Argument Integer value,
//                           @Argument TaskStatus status) {
//        return taskService.updateTask(id, subgroupId, title, description,
//                dueDate, value, status);
//    }
//
//    @MutationMapping
//    public boolean deleteTask(@Argument Long id) {
//        return taskService.deleteTask(id);
//    }
//
//    @MutationMapping
//    public Task assignUserToTask(@Argument Long taskId,
//                                 @Argument Long userId) {
//        return taskService.assignUserToTask(taskId, userId);
//    }
//
//    @MutationMapping
//    public Task unassignUserFromTask(@Argument Long taskId,
//                                     @Argument Long userId) {
//        return taskService.unassignUserFromTask(taskId, userId);
//    }
//
//    @MutationMapping
//    public Task setTaskAssignees(@Argument Long taskId,
//                                 @Argument List<Long> userIds) {
//        return taskService.setTaskAssignees(taskId, userIds);
//    }
//
//    @MutationMapping
//    public Attachment addAttachment(@Argument Long taskId, @Argument MultipartFile file) {
//        return taskService.addAttachment(taskId, file);
//    }
//
//    @MutationMapping
//    public boolean deleteAttachment(@Argument Long id) {
//        taskService.deleteAttachment(id);
//        return true;
//    }
//
//    // ---------- FIELD RESOLVERS (для избежания проблемы N+1) ----------
//    @SchemaMapping(typeName = "User", field = "ownedProjects")
//    public List<Project> ownedProjects(User user) {
//        return projectService.findProjectsByOwner(user.getId());
//    }
//
//    @SchemaMapping(typeName = "User", field = "projectMemberships")
//    public List<ProjectMember> projectMemberships(User user) {
//        return user.getProjectMemberships();
//    }
//
//    @SchemaMapping(typeName = "User", field = "subgroupMemberships")
//    public List<SubgroupMember> subgroupMemberships(User user) {
//        return user.getSubgroupMemberships();
//    }
//
//    @SchemaMapping(typeName = "User", field = "createdTasks")
//    public List<Task> createdTasks(User user) {
//        return taskService.findTasksByCreator(user.getId());
//    }
//
//    @SchemaMapping(typeName = "User", field = "assignedTasks")
//    public List<Task> assignedTasks(User user) {
//        return taskService.findTasksByAssignee(user.getId());
//    }
//
//    @SchemaMapping(typeName = "Project", field = "owner")
//    public User projectOwner(Project project) {
//        return project.getOwner();
//    }
//
//    @SchemaMapping(typeName = "Project", field = "members")
//    public List<ProjectMember> projectMembers(Project project) {
//        return project.getMembers();
//    }
//
//    @SchemaMapping(typeName = "Project", field = "subgroups")
//    public List<Subgroup> projectSubgroups(Project project) {
//        return subgroupService.findSubgroupsByProject(project.getId());
//    }
//
//    @SchemaMapping(typeName = "ProjectMember", field = "project")
//    public Project memberProject(ProjectMember pm) {
//        return pm.getProject();
//    }
//
//    @SchemaMapping(typeName = "ProjectMember", field = "user")
//    public User memberUser(ProjectMember pm) {
//        return pm.getUser();
//    }
//
//    @SchemaMapping(typeName = "Subgroup", field = "project")
//    public Project subgroupProject(Subgroup subgroup) {
//        return subgroup.getProject();
//    }
//
//    @SchemaMapping(typeName = "Subgroup", field = "members")
//    public List<SubgroupMember> subgroupMembers(Subgroup subgroup) {
//        return subgroup.getMembers();
//    }
//
//    @SchemaMapping(typeName = "Subgroup", field = "tasks")
//    public List<Task> subgroupTasks(Subgroup subgroup) {
//        return taskService.findTasksBySubgroup(subgroup.getId());
//    }
//
//    @SchemaMapping(typeName = "SubgroupMember", field = "subgroup")
//    public Subgroup memberSubgroup(SubgroupMember sm) {
//        return sm.getSubgroup();
//    }
//
//    @SchemaMapping(typeName = "SubgroupMember", field = "user")
//    public User subgroupMemberUser(SubgroupMember sm) {
//        return sm.getUser();
//    }
//
//    @SchemaMapping(typeName = "Task", field = "subgroup")
//    public Subgroup taskSubgroup(Task task) {
//        return task.getSubgroup();
//    }
//
//    @SchemaMapping(typeName = "Task", field = "createdBy")
//    public User taskCreatedBy(Task task) {
//        return task.getCreatedBy();
//    }
//
//    @SchemaMapping(typeName = "Task", field = "assignees")
//    public List<User> taskAssignees(Task task) {
//        return task.getAssignees();
//    }
//
//    @SchemaMapping(typeName = "Task", field = "status")
//    public Integer taskStatus(Task task) {
//        return task.getStatus();
//    }
//
//    @SchemaMapping(typeName = "Task", field = "attachments")
//    public List<Attachment> taskAttachmentsResolver(Task task) {
//        return task.getAttachments();
//    }
}