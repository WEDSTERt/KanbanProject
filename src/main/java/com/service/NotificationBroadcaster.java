package com.service;

import com.dto.NotificationDTO;
import com.entity.Task;
import com.entity.Subgroup;
import com.entity.Project;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class NotificationBroadcaster {
    
    // 📢 Уведомления (по пользователям)
    private final Map<Long, Sinks.Many<NotificationDTO>> userSinks = new ConcurrentHashMap<>();
    
    // 🔄 Задачи (глобально)
    private final Sinks.Many<Task> globalTaskUpdates = Sinks.many().multicast().onBackpressureBuffer();
    
    // 📋 Группы/Подгруппы (по проектам)
    private final Map<Long, Sinks.Many<Subgroup>> projectSubgroupSinks = new ConcurrentHashMap<>();
    private final Sinks.Many<Subgroup> globalSubgroupUpdates = Sinks.many().multicast().onBackpressureBuffer();
    
    // 📁 Проекты (глобально)
    private final Sinks.Many<Project> globalProjectUpdates = Sinks.many().multicast().onBackpressureBuffer();
    
    // ============ УВЕДОМЛЕНИЯ ============
    
    public Flux<NotificationDTO> notificationsForUser(Long userId) {
        Sinks.Many<NotificationDTO> sink = userSinks.computeIfAbsent(userId, k -> 
            Sinks.many().multicast()
                .onBackpressureBuffer()
        );
        return sink.asFlux();
    }
    
    public void sendNotification(Long userId, NotificationDTO notification) {
        System.out.println("📬 Broadcasting notification to user " + userId + ": " + notification.getTitle());
        Sinks.Many<NotificationDTO> sink = userSinks.get(userId);
        if (sink != null) {
            sink.tryEmitNext(notification);
        }
    }
    
    // ============ ЗАДАЧИ ============
    
    public Flux<Task> taskUpdatesGlobal() {
        System.out.println("📢 Task subscription started");
        return globalTaskUpdates.asFlux();
    }
    
    public void broadcastTaskUpdate(Task task) {
        if (task != null) {
            System.out.println("🔄 Broadcasting task update: ID " + task.getId() + " - " + task.getTitle());
            globalTaskUpdates.tryEmitNext(task);
        }
    }
    
    // ============ ПОДГРУППЫ/ГРУППЫ ============
    
    public Flux<Subgroup> subgroupUpdatesForProject(Long projectId) {
        System.out.println("📢 Subgroup subscription started for project: " + projectId);
        Sinks.Many<Subgroup> sink = projectSubgroupSinks.computeIfAbsent(projectId, k ->
            Sinks.many().multicast()
                .onBackpressureBuffer()
        );
        return sink.asFlux();
    }
    
    public Flux<Subgroup> subgroupUpdatesGlobal() {
        System.out.println("📢 Global subgroup subscription started");
        return globalSubgroupUpdates.asFlux();
    }
    
    public void broadcastSubgroupUpdate(Subgroup subgroup) {
        if (subgroup != null) {
            System.out.println("📋 Broadcasting subgroup update: ID " + subgroup.getId() + " - " + subgroup.getName());
            
            // 1. Отправить в глобальный поток
            globalSubgroupUpdates.tryEmitNext(subgroup);
            
            // 2. Отправить в поток конкретного проекта
            if (subgroup.getProject() != null) {
                Sinks.Many<Subgroup> projectSink = projectSubgroupSinks.get(subgroup.getProject().getId());
                if (projectSink != null) {
                    projectSink.tryEmitNext(subgroup);
                }
            }
        }
    }
    
    // ============ ПРОЕКТЫ ============
    
    public Flux<Project> projectUpdatesGlobal() {
        System.out.println("📢 Project subscription started");
        return globalProjectUpdates.asFlux();
    }
    
    public void broadcastProjectUpdate(Project project) {
        if (project != null) {
            System.out.println("📁 Broadcasting project update: ID " + project.getId() + " - " + project.getName());
            globalProjectUpdates.tryEmitNext(project);
        }
    }
    
    // ============ СТАТИСТИКА ============
    
    public Map<Long, Sinks.Many<NotificationDTO>> getActiveSinks() {
        return new ConcurrentHashMap<>(userSinks);
    }
}
