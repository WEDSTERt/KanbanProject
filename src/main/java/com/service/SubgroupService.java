package com.service;

import com.controller.TaskSSEController;
import com.entity.*;
import com.repository.ProjectRepository;
import com.repository.SubgroupMemberRepository;
import com.repository.SubgroupRepository;
import com.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.ApplicationContext;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

@Service
public class SubgroupService {

    private final SubgroupRepository subgroupRepository;
    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final SubgroupMemberRepository subgroupMemberRepository;
    private final EmailNotificationService emailNotificationService;
    private final NotificationService notificationService;
    private final ApplicationContext applicationContext;

    @Autowired
    public SubgroupService(SubgroupRepository subgroupRepository,
                           ProjectRepository projectRepository,
                           UserRepository userRepository,
                           SubgroupMemberRepository subgroupMemberRepository,
                           EmailNotificationService emailNotificationService,
                           NotificationService notificationService,
                           ApplicationContext applicationContext) {
        this.subgroupRepository = subgroupRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.subgroupMemberRepository = subgroupMemberRepository;
        this.emailNotificationService = emailNotificationService;
        this.notificationService = notificationService;
        this.applicationContext = applicationContext;
    }

    /**
     * Получить SSE контроллер через ApplicationContext (избегаем циклических зависимостей)
     */
    private TaskSSEController getSSEController() {
        try {
            return applicationContext.getBean(TaskSSEController.class);
        } catch (Exception e) {
            System.err.println("❌ Failed to get SSE Controller: " + e.getMessage());
            return null;
        }
    }

    /**
     * Отправить SSE событие о изменении подгрупп в проекте АСИНХРОННО
     */
    private void notifySubgroupsChangedAsync(Long projectId) {
        // Отправляем SSE событие в отдельном потоке
        CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(100); // Небольшая задержка чтобы убедиться что транзакция коммитилась
                TaskSSEController sseController = getSSEController();
                if (sseController != null) {
                    System.out.println("📡 Sending subgroups-changed event to project " + projectId);
                    sseController.notifySubgroupsChanged(projectId);
                    System.out.println("✅ Sent subgroups-changed event to project " + projectId);
                } else {
                    System.err.println("❌ SSE Controller is null");
                }
            } catch (Exception e) {
                System.err.println("❌ Error sending subgroups-changed event: " + e.getMessage());
                e.printStackTrace();
            }
        });
    }

    @CacheEvict(value = {"subgroups", "projectDetails"}, allEntries = true)
    @Transactional
    public Subgroup createSubgroup(Long projectId, String name, Long creatorUserId) {
        System.out.println("📝 Creating subgroup: " + name + " in project " + projectId);
        
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
        
        // 📡 Отправляем SSE событие АСИНХРОННО
        notifySubgroupsChangedAsync(projectId);
        
        return subgroup;
    }

    @CacheEvict(value = {"subgroups", "projectDetails"}, allEntries = true)
    @Transactional
    public Subgroup updateSubgroup(Long id, String name) {
        System.out.println("✏️ Updating subgroup " + id + " name to: " + name);
        
        Subgroup subgroup = subgroupRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Subgroup not found"));
        if (name != null) subgroup.setName(name);
        subgroup = subgroupRepository.save(subgroup);
        
        // 📡 Отправляем SSE событие АСИНХРОННО
        notifySubgroupsChangedAsync(subgroup.getProjectId());
        
        return subgroup;
    }

    @CacheEvict(value = {"subgroups", "projectDetails", "tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public boolean deleteSubgroup(Long id) {
        System.out.println("🗑️ Deleting subgroup " + id);
        
        Optional<Subgroup> subgroupOpt = subgroupRepository.findById(id);
        if (subgroupOpt.isPresent()) {
            Subgroup subgroup = subgroupOpt.get();
            Long projectId = subgroup.getProjectId();
            
            subgroupRepository.deleteById(id);
            
            // 📡 Отправляем SSE событие АСИНХРОННО
            notifySubgroupsChangedAsync(projectId);
            
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
        System.out.println("👤 Adding user " + userId + " to subgroup " + subgroupId + " as " + role);
        
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
        System.out.println("👤 Adding user " + userId + " to subgroup " + subgroupId + " with notification");
        
        Subgroup subgroup = subgroupRepository.findById(subgroupId)
                .orElseThrow(() -> new RuntimeException("Subgroup not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (subgroupMemberRepository.existsBySubgroupIdAndUserId(subgroupId, userId)) {
            throw new RuntimeException("User already member of this subgroup");
        }
        SubgroupMember sm = new SubgroupMember(subgroup, user, role != null ? role : RoleSubgroup.MEMBER);
        SubgroupMember saved = subgroupMemberRepository.save(sm);

        // Отправляем email уведомление
        if (addedBy != null && !addedBy.getId().equals(userId)) {
            try {
                emailNotificationService.notifyUserAddedToSubgroup(subgroup, user, addedBy, role != null ? role.name() : "MEMBER");
            } catch (Exception e) {
                System.err.println("Warning: Failed to send email notification: " + e.getMessage());
            }
        }
        
        // Отправляем in-app уведомление
        try {
            String addedByName = addedBy != null ? addedBy.getFullName() : "Администратор";
            notificationService.createNotification(
                userId,
                "SUBGROUP_MEMBER_ADDED",
                "Добавлены в группу",
                addedByName + " добавил вас в группу \"" + subgroup.getName() + "\"",
                null,
                subgroup.getProjectId()
            );
        } catch (Exception e) {
            System.err.println("Warning: Failed to create in-app notification: " + e.getMessage());
        }

        // 📡 Отправляем SSE событие АСИНХРОННО
        notifySubgroupsChangedAsync(subgroup.getProjectId());

        return saved;
    }

    @CacheEvict(value = {"subgroups", "projectDetails", "tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public SubgroupMember updateSubgroupMember(Long memberId, RoleSubgroup role) {
        System.out.println("🔄 Updating subgroup member " + memberId + " role to " + role);
        
        SubgroupMember sm = subgroupMemberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Subgroup member not found"));
        sm.setRole(role);
        return subgroupMemberRepository.save(sm);
    }

    @CacheEvict(value = {"subgroups", "projectDetails", "tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public boolean removeSubgroupMember(Long memberId) {
        System.out.println("🗑️ Removing subgroup member " + memberId);
        
        Optional<SubgroupMember> memberOpt = subgroupMemberRepository.findById(memberId);
        if (memberOpt.isPresent()) {
            SubgroupMember member = memberOpt.get();
            
            Subgroup subgroup = member.getSubgroup();
            User removedUser = member.getUser();
            Long projectId = subgroup.getProjectId();

            subgroupMemberRepository.deleteById(memberId);
            
            // Отправляем email уведомление
            try {
                emailNotificationService.notifyUserRemovedFromSubgroup(subgroup, removedUser);
            } catch (Exception e) {
                System.err.println("Warning: Failed to send email notification: " + e.getMessage());
            }
            
            // Отправляем in-app уведомление
            try {
                notificationService.createNotification(
                    removedUser.getId(),
                    "SUBGROUP_MEMBER_REMOVED",
                    "Удалены из группы",
                    "Вы удалены из группы \"" + subgroup.getName() + "\"",
                    null,
                    projectId
                );
            } catch (Exception e) {
                System.err.println("Warning: Failed to create in-app notification: " + e.getMessage());
            }

            // 📡 Отправляем SSE событие АСИНХРОННО
            notifySubgroupsChangedAsync(projectId);
            
            return true;
        }
        return false;
    }
}
