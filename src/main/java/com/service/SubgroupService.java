package com.service;

import com.entity.*;
import com.repository.ProjectRepository;
import com.repository.SubgroupMemberRepository;
import com.repository.SubgroupRepository;
import com.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class SubgroupService {

    private final SubgroupRepository subgroupRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final SubgroupMemberRepository subgroupMemberRepository;

    public SubgroupService(SubgroupRepository subgroupRepository,
                           ProjectRepository projectRepository,
                           UserRepository userRepository,
                           SubgroupMemberRepository subgroupMemberRepository) {
        this.subgroupRepository = subgroupRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.subgroupMemberRepository = subgroupMemberRepository;
    }

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

    @Transactional
    public Subgroup updateSubgroup(Long id, String name) {
        Subgroup subgroup = subgroupRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Subgroup not found"));
        if (name != null) subgroup.setName(name);
        return subgroupRepository.save(subgroup);
    }

    @Transactional
    public boolean deleteSubgroup(Long id) {
        if (subgroupRepository.existsById(id)) {
            subgroupRepository.deleteById(id);
            return true;
        }
        return false;
    }

    public Optional<Subgroup> findById(Long id) {
        return subgroupRepository.findById(id);
    }

    public List<Subgroup> findSubgroupsByProject(Long projectId) {
        return subgroupRepository.findByProjectIdWithMembers(projectId);
    }

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

    @Transactional
    public SubgroupMember updateSubgroupMember(Long memberId, RoleSubgroup role) {
        SubgroupMember sm = subgroupMemberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Subgroup member not found"));
        sm.setRole(role);
        return subgroupMemberRepository.save(sm);
    }

    @Transactional
    public boolean removeSubgroupMember(Long memberId) {
        if (subgroupMemberRepository.existsById(memberId)) {
            subgroupMemberRepository.deleteById(memberId);
            return true;
        }
        return false;
    }
}