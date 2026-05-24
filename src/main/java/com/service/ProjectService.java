package com.service;

import com.entity.Project;
import com.entity.ProjectMember;
import com.entity.RoleProject;
import com.entity.User;
import com.repository.ProjectMemberRepository;
import com.repository.ProjectRepository;
import com.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;

import java.util.List;
import java.util.Optional;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final EmailNotificationService emailNotificationService;

    public ProjectService(ProjectRepository projectRepository,
                          UserRepository userRepository,
                          ProjectMemberRepository projectMemberRepository,
                          EmailNotificationService emailNotificationService) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
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
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (projectMemberRepository.existsByProjectIdAndUserId(projectId, userId)) {
            throw new RuntimeException("User already member of this project");
        }
        ProjectMember pm = new ProjectMember(project, user, role != null ? role : RoleProject.VIEWER);

        // Отправляем уведомление
        if (addedBy != null && !addedBy.getId().equals(userId)) {
            emailNotificationService.notifyUserAddedToProject(project, user, addedBy, role != null ? role.name() : "VIEWER");
        }

        return projectMemberRepository.save(pm);
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
        if (projectMemberRepository.existsById(memberId)) {
            projectMemberRepository.deleteById(memberId);
            return true;
        }
        return false;
    }
}