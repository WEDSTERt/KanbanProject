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

import java.util.List;
import java.util.Optional;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;

    public ProjectService(ProjectRepository projectRepository,
                          UserRepository userRepository,
                          ProjectMemberRepository projectMemberRepository) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.projectMemberRepository = projectMemberRepository;
    }

    @Transactional
    public Project createProject(String name, Long ownerUserId) {
        User owner = userRepository.findById(ownerUserId)
                .orElseThrow(() -> new RuntimeException("Owner user not found"));
        Project project = new Project(name, owner);
        project = projectRepository.save(project);
        addProjectMember(project.getId(), ownerUserId, RoleProject.OWNER);
        return project;
    }

    @Transactional
    public Project updateProject(Long id, String name) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        if (name != null) project.setName(name);
        return projectRepository.save(project);
    }

    @Transactional
    public boolean deleteProject(Long id) {
        if (projectRepository.existsById(id)) {
            projectRepository.deleteById(id);
            return true;
        }
        return false;
    }

    public Optional<Project> findById(Long id) {
        return projectRepository.findById(id);
    }

    public List<Project> findProjectsByOwner(Long ownerUserId) {
        return projectRepository.findByOwnerUserId(ownerUserId);
    }

    public List<Project> findProjectsByMember(Long userId) {
        return projectRepository.findProjectsByMemberUserId(userId);
    }

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

    @Transactional
    public ProjectMember updateProjectMember(Long memberId, RoleProject role) {
        ProjectMember pm = projectMemberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Project member not found"));
        pm.setRole(role);
        return projectMemberRepository.save(pm);
    }

    @Transactional
    public boolean removeProjectMember(Long memberId) {
        if (projectMemberRepository.existsById(memberId)) {
            projectMemberRepository.deleteById(memberId);
            return true;
        }
        return false;
    }
}