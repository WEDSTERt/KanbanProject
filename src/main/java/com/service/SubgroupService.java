package com.service;

import com.entity.*;
import com.repository.ProjectRepository;
import com.repository.SubgroupMemberRepository;
import com.repository.SubgroupRepository;
import com.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;

import java.util.List;
import java.util.Optional;

@Service
public class SubgroupService {

    private final SubgroupRepository subgroupRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final SubgroupMemberRepository subgroupMemberRepository;
    private final EmailNotificationService emailNotificationService;

    public SubgroupService(SubgroupRepository subgroupRepository,
                           ProjectRepository projectRepository,
                           UserRepository userRepository,
                           SubgroupMemberRepository subgroupMemberRepository,
                           EmailNotificationService emailNotificationService) {
        this.subgroupRepository = subgroupRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.subgroupMemberRepository = subgroupMemberRepository;
        this.emailNotificationService = emailNotificationService;
    }

    @CacheEvict(value = {"subgroups", "projectDetails"}, allEntries = true)
    @Transactional
    public Subgroup createSubgroup(Long projectId, String name, Long creatorUserId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        boolean exists = subgroupRepository.findByProjectId(projectId)
                .stream()
                .anyMatch(s -> s.getName().equalsIgnoreCase(name));
        if (exists) {
            throw new RuntimeException("Subgroup with this name already exists in the project");
        }
        Subgroup subgroup = new Subgroup(name, project);
        subgroup = subgroupRepository.save(subgroup);
        addSubgroupMember(subgroup.getId(), creatorUserId, RoleSubgroup.LEADER);
        return subgroup;
    }

    @CacheEvict(value = {"subgroups", "projectDetails"}, allEntries = true)
    @Transactional
    public Subgroup updateSubgroup(Long id, String name) {
        Subgroup subgroup = subgroupRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Subgroup not found"));
        if (name != null) subgroup.setName(name);
        return subgroupRepository.save(subgroup);
    }

    @CacheEvict(value = {"subgroups", "projectDetails", "tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public boolean deleteSubgroup(Long id) {
        if (subgroupRepository.existsById(id)) {
            subgroupRepository.deleteById(id);
            return true;
        }
        return false;
    }

    @Cacheable(value = "subgroups", key = "#id")
    public Optional<Subgroup> findById(Long id) {
        return subgroupRepository.findById(id);
    }

    @Cacheable(value = "subgroups", key = "#projectId")
    public List<Subgroup> findSubgroupsByProject(Long projectId) {
        return subgroupRepository.findByProjectIdWithMembers(projectId);
    }

    @CacheEvict(value = {"subgroups", "projectDetails", "tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public SubgroupMember addSubgroupMember(Long subgroupId, Long userId, RoleSubgroup role) {
        Subgroup subgroup = subgroupRepository.findById(subgroupId)
                .orElseThrow(() -> new RuntimeException("Subgroup not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (subgroupMemberRepository.existsBySubgroupIdAndUserId(subgroupId, userId)) {
            throw new RuntimeException("User already member of this subgroup");
        }
        SubgroupMember sm = new SubgroupMember(subgroup, user, role != null ? role : RoleSubgroup.MEMBER);
        return subgroupMemberRepository.save(sm);
    }

    @CacheEvict(value = {"subgroups", "projectDetails", "tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public SubgroupMember addSubgroupMemberWithNotification(Long subgroupId, Long userId, RoleSubgroup role, User addedBy) {
        Subgroup subgroup = subgroupRepository.findById(subgroupId)
                .orElseThrow(() -> new RuntimeException("Subgroup not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (subgroupMemberRepository.existsBySubgroupIdAndUserId(subgroupId, userId)) {
            throw new RuntimeException("User already member of this subgroup");
        }
        SubgroupMember sm = new SubgroupMember(subgroup, user, role != null ? role : RoleSubgroup.MEMBER);

        // Отправляем уведомление
        if (addedBy != null && !addedBy.getId().equals(userId)) {
            emailNotificationService.notifyUserAddedToSubgroup(subgroup, user, addedBy, role != null ? role.name() : "MEMBER");
        }

        return subgroupMemberRepository.save(sm);
    }

    @CacheEvict(value = {"subgroups", "projectDetails", "tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public SubgroupMember updateSubgroupMember(Long memberId, RoleSubgroup role) {
        SubgroupMember sm = subgroupMemberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Subgroup member not found"));
        sm.setRole(role);
        return subgroupMemberRepository.save(sm);
    }

    @CacheEvict(value = {"subgroups", "projectDetails", "tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public boolean removeSubgroupMember(Long memberId) {
        if (subgroupMemberRepository.existsById(memberId)) {
            subgroupMemberRepository.deleteById(memberId);
            return true;
        }
        return false;
    }
}