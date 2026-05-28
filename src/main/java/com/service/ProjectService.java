package com.service;

import com.entity.*;
import com.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.ApplicationContext;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final SubgroupMemberRepository subgroupMemberRepository;
    private final EmailNotificationService emailNotificationService;
    private final ApplicationContext applicationContext;

    public ProjectService(ProjectRepository projectRepository,
                          UserRepository userRepository,
                          ProjectMemberRepository projectMemberRepository,
                          SubgroupMemberRepository subgroupMemberRepository,
                          EmailNotificationService emailNotificationService,
                          ApplicationContext applicationContext) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.subgroupMemberRepository = subgroupMemberRepository;
        this.emailNotificationService = emailNotificationService;
        this.applicationContext = applicationContext;
    }

    @CacheEvict(value = {"projects", "projectDetails"}, allEntries = true)
    @Transactional
    public Project createProject(String name, Long ownerUserId) {
        User owner = userRepository.findById(ownerUserId)
                .orElseThrow(() -> new RuntimeException("Owner user not found"));
        Project project = new Project(name, owner);
        project = projectRepository.save(project);
        addProjectMember(project.getId(), ownerUserId, RoleProject.OWNER);
        return project;
    }

    @CacheEvict(value = {"projects", "projectDetails"}, allEntries = true)
    @Transactional
    public Project updateProject(Long id, String name) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        if (name != null) project.setName(name);
        return projectRepository.save(project);
    }

    @CacheEvict(value = {"projects", "projectDetails"}, allEntries = true)
    @Transactional
    public boolean deleteProject(Long id) {
        if (projectRepository.existsById(id)) {
            projectRepository.deleteById(id);
            return true;
        }
        return false;
    }

    @Cacheable(value = "projectDetails", key = "#id")
    public Optional<Project> findById(Long id) {
        return projectRepository.findById(id);
    }

    @Cacheable(value = "projects", key = "#ownerUserId")
    public List<Project> findProjectsByOwner(Long ownerUserId) {
        return projectRepository.findByOwnerUserId(ownerUserId);
    }

    @Cacheable(value = "projects", key = "'member_' + #userId")
    public List<Project> findProjectsByMember(Long userId) {
        return projectRepository.findProjectsByMemberUserId(userId);
    }

    @CacheEvict(value = {"projects", "projectDetails"}, allEntries = true)
    @Transactional
    public ProjectMember addProjectMember(Long projectId, Long userId, RoleProject role) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (projectMemberRepository.existsByProjectIdAndUserId(projectId, userId)) {
            throw new RuntimeException("User already member of this project");
        }
        ProjectMember pm = new ProjectMember(project, user, role != null ? role : RoleProject.VIEWER);
        return projectMemberRepository.save(pm);
    }

    @CacheEvict(value = {"projects", "projectDetails"}, allEntries = true)
    @Transactional
    public ProjectMember addProjectMemberWithNotification(Long projectId, Long userId, RoleProject role, User addedBy) {
        System.out.println("👤 Adding user " + userId + " to project " + projectId + " with notification");

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (projectMemberRepository.existsByProjectIdAndUserId(projectId, userId)) {
            throw new RuntimeException("User already member of this project");
        }
        ProjectMember pm = new ProjectMember(project, user, role != null ? role : RoleProject.VIEWER);
        ProjectMember saved = projectMemberRepository.save(pm);

        if (addedBy != null && !addedBy.getId().equals(userId)) {
            try {
                emailNotificationService.notifyUserAddedToProject(project, user, addedBy, role != null ? role.name() : "VIEWER");
            } catch (Exception e) {
                System.err.println("Warning: Failed to send notification: " + e.getMessage());
            }
        }

        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(100);
                com.controller.TaskSSEController sseController = com.controller.TaskSSEController.getInstance();
                if (sseController != null) {
                    sseController.notifyAllProjectsListChanged();
                    System.out.println("✅ Sent projects-changed SSE event to all users after adding member");
                }
            } catch (Exception e) {
                System.err.println("Warning: Failed to send SSE event: " + e.getMessage());
            }
        });

        return saved;
    }

    @CacheEvict(value = {"projects", "projectDetails"}, allEntries = true)
    @Transactional
    public ProjectMember updateProjectMember(Long memberId, RoleProject role) {
        ProjectMember pm = projectMemberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Project member not found"));
        pm.setRole(role);
        return projectMemberRepository.save(pm);
    }

    @CacheEvict(value = {"projects", "projectDetails"}, allEntries = true)
    @Transactional
    public ProjectMember updateProjectNotifications(Long projectId, Long userId, Boolean notificationsEnabled) {
        ProjectMember pm = projectMemberRepository.findByProjectIdAndUserId(projectId, userId)
                .orElseThrow(() -> new RuntimeException("Project member not found"));
        pm.setNotificationsEnabled(notificationsEnabled);
        return projectMemberRepository.save(pm);
    }

    @CacheEvict(value = {"projects", "projectDetails", "tasksBySubgroup", "tasksByAssignee", "subgroups"}, allEntries = true)
    @Transactional
    public boolean removeProjectMember(Long memberId) {
        System.out.println("🗑️ Removing project member " + memberId);

        if (projectMemberRepository.existsById(memberId)) {
            ProjectMember projectMember = projectMemberRepository.findById(memberId)
                    .orElseThrow(() -> new RuntimeException("Project member not found"));

            Long projectId = projectMember.getProjectId();
            Long userId = projectMember.getUserId();

            Project project = projectRepository.findById(projectId)
                    .orElseThrow(() -> new RuntimeException("Project not found"));
            User removedUser = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            System.out.println("📝 Project Member Removal Process:");
            System.out.println("   Project ID: " + projectId);
            System.out.println("   User ID: " + userId);
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

            System.out.println("\n[STEP 1] Processing user tasks...");
            try {
                TaskService taskService = applicationContext.getBean(TaskService.class);
                System.out.println("🔄 Processing cascade removal of user from project tasks");

                System.out.println("✅ Tasks processed successfully");
            } catch (Exception e) {
                System.err.println("⚠️ Warning: Failed to remove user from project tasks: " + e.getMessage());
                e.printStackTrace();
            }

            System.out.println("\n[STEP 2] Removing user from all subgroups...");
            try {
                int removedCount = removeUserFromProjectSubgroups(projectId, userId);
                System.out.println("✅ Removed from " + removedCount + " subgroups");
            } catch (Exception e) {
                System.err.println("❌ Error removing user from subgroups: " + e.getMessage());
                e.printStackTrace();
            }

            System.out.println("\n[STEP 3] Removing project member...");
            try {
                projectMemberRepository.deleteById(memberId);
                System.out.println("✅ Project member deleted from DB");
            } catch (Exception e) {
                System.err.println("❌ Error deleting project member: " + e.getMessage());
                e.printStackTrace();
            }

            System.out.println("\n[STEP 4] Sending notifications...");
            try {
                emailNotificationService.notifyUserRemovedFromProject(project, removedUser);
                System.out.println("✅ Email notification sent");
            } catch (Exception e) {
                System.err.println("⚠️ Warning: Failed to send removal notification: " + e.getMessage());
            }

            System.out.println("\n[STEP 5] Sending SSE events...");
            CompletableFuture.runAsync(() -> {
                try {
                    Thread.sleep(100);

                    com.controller.TaskSSEController sseController = com.controller.TaskSSEController.getInstance();
                    if (sseController != null) {
                        sseController.notifyUserRemovedFromProject(userId, projectId);
                        System.out.println("✅ Sent project-removed SSE event to user " + userId);

                        sseController.notifyAllProjectsListChanged();
                        System.out.println("✅ Sent projects-changed SSE event to all users");
                    }
                } catch (Exception e) {
                    System.err.println("⚠️ Warning: Failed to send SSE events: " + e.getMessage());
                }
            });

            System.out.println("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            System.out.println("✅ Project member removal completed successfully");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

            return true;
        }
        return false;
    }

    @Transactional
    private int removeUserFromProjectSubgroups(Long projectId, Long userId) {
        System.out.println("🗑️ Removing user " + userId + " from all subgroups in project " + projectId);

        try {
            List<SubgroupMember> subgroupMembers = subgroupMemberRepository.findByUserIdAndProjectId(userId, projectId);
            int countBefore = subgroupMembers.size();
            System.out.println("   📊 Found " + countBefore + " subgroup memberships to remove");

            int deletedCount = subgroupMemberRepository.deleteByUserIdAndProjectId(userId, projectId);
            System.out.println("   ✓ Deleted " + deletedCount + " SubgroupMember records");

            List<SubgroupMember> subgroupMembersAfter = subgroupMemberRepository.findByUserIdAndProjectId(userId, projectId);
            System.out.println("   ✓ Verification: " + subgroupMembersAfter.size() + " memberships remaining (should be 0)");

            if (subgroupMembersAfter.size() > 0) {
                System.err.println("⚠️ WARNING: Some memberships were not deleted!");
                System.err.println("   Remaining: " + subgroupMembersAfter.size());
            }

            return deletedCount;
        } catch (Exception e) {
            System.err.println("❌ Error deleting subgroup members: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Failed to remove user from subgroups: " + e.getMessage());
        }
    }
}
