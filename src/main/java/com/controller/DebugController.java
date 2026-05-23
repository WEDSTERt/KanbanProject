package com.controller;

import com.entity.*;
import com.repository.*;
import com.service.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/debug")
public class DebugController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProjectMemberRepository projectMemberRepository;

    @Autowired
    private SubgroupRepository subgroupRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private AttachmentRepository attachmentRepository;

    @Autowired
    private CacheManager cacheManager;

    @Autowired
    private UserService userService;

    @Autowired
    private ProjectService projectService;

    // ============ ОБЩАЯ ИНФОРМАЦИЯ ============

    @GetMapping("/info")
    public Map<String, Object> getInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("usersCount", userRepository.count());
        info.put("projectsCount", projectRepository.count());
        info.put("projectMembersCount", projectMemberRepository.count());
        info.put("subgroupsCount", subgroupRepository.count());
        info.put("tasksCount", taskRepository.count());
        info.put("attachmentsCount", attachmentRepository.count());
        info.put("caches", cacheManager.getCacheNames());
        return info;
    }

    // ============ ПОЛЬЗОВАТЕЛИ ============

    @GetMapping("/users")
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @GetMapping("/users/{id}")
    public Optional<User> getUserById(@PathVariable Long id) {
        return userRepository.findById(id);
    }

    @GetMapping("/users/email/{email}")
    public Optional<User> getUserByEmail(@PathVariable String email) {
        return userRepository.findByEmail(email);
    }

    // ============ ПРОЕКТЫ ============

    @GetMapping("/projects")
    public List<Project> getAllProjects() {
        return projectRepository.findAll();
    }

    @GetMapping("/projects/owner/{ownerUserId}")
    public List<Project> getProjectsByOwner(@PathVariable Long ownerUserId) {
        return projectRepository.findByOwnerUserId(ownerUserId);
    }

    @GetMapping("/projects/member/{userId}")
    public List<Project> getProjectsByMember(@PathVariable Long userId) {
        return projectRepository.findProjectsByMemberUserId(userId);
    }

    @GetMapping("/projects/{id}/members")
    public List<ProjectMember> getProjectMembers(@PathVariable Long id) {
        return projectRepository.findById(id)
                .map(Project::getMembers)
                .orElse(Collections.emptyList());
    }

    // ============ ЧЛЕНЫ ПРОЕКТОВ ============

    @GetMapping("/project-members")
    public List<ProjectMember> getAllProjectMembers() {
        return projectMemberRepository.findAll();
    }

    @GetMapping("/project-members/user/{userId}")
    public List<ProjectMember> getProjectMembersByUser(@PathVariable Long userId) {
        return projectMemberRepository.findAll().stream()
                .filter(pm -> pm.getUserId().equals(userId))
                .collect(Collectors.toList());
    }

    // ============ ПОДГРУППЫ ============

    @GetMapping("/subgroups")
    public List<Subgroup> getAllSubgroups() {
        return subgroupRepository.findAll();
    }

    @GetMapping("/subgroups/project/{projectId}")
    public List<Subgroup> getSubgroupsByProject(@PathVariable Long projectId) {
        return subgroupRepository.findByProjectId(projectId);
    }

    // ============ ЗАДАЧИ ============

    @GetMapping("/tasks")
    public List<Task> getAllTasks() {
        return taskRepository.findAll();
    }

    @GetMapping("/tasks/subgroup/{subgroupId}")
    public List<Task> getTasksBySubgroup(@PathVariable Long subgroupId) {
        return taskRepository.findBySubgroupId(subgroupId);
    }

    @GetMapping("/tasks/assignee/{userId}")
    public List<Task> getTasksByAssignee(@PathVariable Long userId) {
        return taskRepository.findByAssigneesId(userId);
    }

    // ============ ТЕСТИРОВАНИЕ API ============

    @GetMapping("/test/projects-for-user/{userId}")
    public Map<String, Object> testProjectsForUser(@PathVariable Long userId) {
        Map<String, Object> result = new HashMap<>();

        // Проверяем через репозиторий напрямую
        List<Project> ownedViaRepo = projectRepository.findByOwnerUserId(userId);
        List<Project> memberViaRepo = projectRepository.findProjectsByMemberUserId(userId);

        // Проверяем через сервис (с кэшем)
        List<Project> ownedViaService = projectService.findProjectsByOwner(userId);
        List<Project> memberViaService = projectService.findProjectsByMember(userId);

        result.put("userId", userId);
        result.put("ownedViaRepo", ownedViaRepo.stream().map(p -> Map.of("id", p.getId(), "name", p.getName())).collect(Collectors.toList()));
        result.put("memberViaRepo", memberViaRepo.stream().map(p -> Map.of("id", p.getId(), "name", p.getName())).collect(Collectors.toList()));
        result.put("ownedViaService", ownedViaService.stream().map(p -> Map.of("id", p.getId(), "name", p.getName())).collect(Collectors.toList()));
        result.put("memberViaService", memberViaService.stream().map(p -> Map.of("id", p.getId(), "name", p.getName())).collect(Collectors.toList()));
        result.put("ownedCount", ownedViaRepo.size());
        result.put("memberCount", memberViaRepo.size());

        return result;
    }

    @GetMapping("/test/raw-sql/user/{userId}")
    public Map<String, Object> testRawSQL(@PathVariable Long userId) {
        Map<String, Object> result = new HashMap<>();

        // Симулируем прямой SQL запрос через JPA
        List<Map<String, Object>> projects = new ArrayList<>();
        for (Project p : projectRepository.findAll()) {
            for (ProjectMember pm : p.getMembers()) {
                if (pm.getUserId().equals(userId)) {
                    Map<String, Object> proj = new HashMap<>();
                    proj.put("projectId", p.getId());
                    proj.put("projectName", p.getName());
                    proj.put("memberId", pm.getId());
                    proj.put("memberRole", pm.getRole());
                    proj.put("memberUserId", pm.getUserId());
                    projects.add(proj);
                }
            }
        }

        result.put("userId", userId);
        result.put("projectsWhereUserIsMember", projects);
        result.put("count", projects.size());

        return result;
    }

    // ============ КЭШ ============

    @GetMapping("/cache")
    public Map<String, Object> getCacheStats() {
        Map<String, Object> stats = new HashMap<>();
        for (String name : cacheManager.getCacheNames()) {
            stats.put(name, "available");
        }
        return stats;
    }

    @DeleteMapping("/cache/clear")
    public String clearAllCaches() {
        for (String name : cacheManager.getCacheNames()) {
            cacheManager.getCache(name).clear();
        }
        return "All caches cleared!";
    }

    @DeleteMapping("/cache/clear/{cacheName}")
    public String clearCache(@PathVariable String cacheName) {
        if (cacheManager.getCache(cacheName) != null) {
            cacheManager.getCache(cacheName).clear();
            return "Cache '" + cacheName + "' cleared!";
        }
        return "Cache '" + cacheName + "' not found!";
    }

    // ============ ОЧИСТКА КЭША ПРИНУДИТЕЛЬНО (для кэшированных методов) ============

    @PostMapping("/refresh/member-projects/{userId}")
    public String refreshMemberProjects(@PathVariable Long userId) {
        // Очищаем кэш projects для этого userId
        cacheManager.getCache("projects").evict(userId);
        return "Cache for userId " + userId + " cleared! Now call findProjectsByMember again.";
    }
}