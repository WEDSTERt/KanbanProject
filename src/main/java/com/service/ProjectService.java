package com.service;

import com.entity.Project;
import com.entity.ProjectMember;
import com.entity.RoleProject;
import com.entity.User;
import com.repository.ProjectMemberRepository;
import com.repository.ProjectRepository;
import com.repository.SubgroupMemberRepository;
import com.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
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

    public ProjectService(ProjectRepository projectRepository,
                          UserRepository userRepository,
                          ProjectMemberRepository projectMemberRepository,
                          SubgroupMemberRepository subgroupMemberRepository,
                          EmailNotificationService emailNotificationService) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.subgroupMemberRepository = subgroupMemberRepository;
        this.emailNotificationService = emailNotificationService;
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

        // Отправляем уведомление внутри транзакции
        if (addedBy != null && !addedBy.getId().equals(userId)) {
            try {
                emailNotificationService.notifyUserAddedToProject(project, user, addedBy, role != null ? role.name() : "VIEWER");
            } catch (Exception e) {
                System.err.println("Warning: Failed to send notification: " + e.getMessage());
            }
        }

        // 📡 Отправляем SSE событие АСИНХРОННО (в отдельном потоке) ВСЕ пользователям
        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(100); // Небольшая задержка чтобы убедиться что транзакция коммитилась
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

    @CacheEvict(value = {"projects", "projectDetails"}, allEntries = true)
    @Transactional
    public boolean removeProjectMember(Long memberId) {
        System.out.println("🗑️ Removing project member " + memberId);
        
        if (projectMemberRepository.existsById(memberId)) {
            // Получаем ProjectMember перед удалением
            ProjectMember projectMember = projectMemberRepository.findById(memberId)
                    .orElseThrow(() -> new RuntimeException("Project member not found"));

            Long projectId = projectMember.getProjectId();
            Long userId = projectMember.getUserId();

            Project project = projectRepository.findById(projectId)
                    .orElseThrow(() -> new RuntimeException("Project not found"));
            User removedUser = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            // Удаляем все SubgroupMemberships этого пользователя из подгрупп этого проекта
            removeUserFromProjectSubgroups(projectId, userId);

            // Удаляем ProjectMember
            projectMemberRepository.deleteById(memberId);
            System.out.println("✅ Project member deleted from DB");

            // Отправляем уведомление об удалении из проекта
            try {
                emailNotificationService.notifyUserRemovedFromProject(project, removedUser);
            } catch (Exception e) {
                System.err.println("Warning: Failed to send removal notification: " + e.getMessage());
            }

            // 📡 Отправляем SSE события АСИНХРОННО (в отдельном потоке)
            // Это гарантирует что события отправятся даже если клиент отключится сразу после удаления
            CompletableFuture.runAsync(() -> {
                try {
                    Thread.sleep(100); // Небольшая задержка чтобы убедиться что транзакция коммитилась
                    
                    // Отправляем событие удаленному пользователю
                    com.controller.TaskSSEController sseController = com.controller.TaskSSEController.getInstance();
                    if (sseController != null) {
                        sseController.notifyUserRemovedFromProject(userId, projectId);
                        System.out.println("✅ Sent project-removed SSE event to user " + userId);
                    }
                    
                    // Отправляем событие ВСЕ пользователям (обновление списка проектов)
                    if (sseController != null) {
                        sseController.notifyAllProjectsListChanged();
                        System.out.println("✅ Sent projects-changed SSE event to all users after removing member");
                    }
                } catch (Exception e) {
                    System.err.println("Warning: Failed to send SSE events: " + e.getMessage());
                }
            });

            return true;
        }
        return false;
    }

    /**
     * Удаляет пользователя из всех подгрупп проекта (каскадное удаление)
     */
    @Transactional
    private void removeUserFromProjectSubgroups(Long projectId, Long userId) {
        System.out.println("Removing user " + userId + " from all subgroups in project " + projectId);
        // Используем SQL DELETE для удаления всех SubgroupMembers
        subgroupMemberRepository.deleteByUserIdAndProjectId(userId, projectId);
    }
}
