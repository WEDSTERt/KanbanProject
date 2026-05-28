package com.controller;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.stereotype.Controller;
import java.util.*;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * SSE контроллер для отправки real-time событий
 * 
 * События:
 * - projects-changed: Изменения в списке проектов
 * - project-removed: Пользователя удалили из проекта (перенаправить на главную)
 * - notification-received: Новое уведомление
 * - subgroups-changed: Изменения в списке групп
 * - task-updated: Задача обновлена
 * - task-deleted: Задача удалена
 */
@Controller
public class TaskSSEController {
    
    private static TaskSSEController instance;
    
    // Храним эмиттеры для каждого пользователя
    private final Map<Long, SseEmitter> userEmitters = new ConcurrentHashMap<>();
    
    // Храним эмиттеры для каждого проекта
    private final Map<Long, List<SseEmitter>> projectEmitters = new ConcurrentHashMap<>();
    
    // Храним эмиттеры для каждой подгруппы
    private final Map<Long, List<SseEmitter>> subgroupEmitters = new ConcurrentHashMap<>();
    
    private static final long TIMEOUT = 5 * 60 * 1000; // 5 минут timeout

    public TaskSSEController() {
        instance = this;
    }

    public static TaskSSEController getInstance() {
        return instance;
    }

    /**
     * Подключение пользователя к глобальному каналу событий
     */
    public SseEmitter subscribe(Long userId) {
        System.out.println("📡 User " + userId + " subscribing to global events");
        
        SseEmitter emitter = new SseEmitter(TIMEOUT);
        userEmitters.put(userId, emitter);
        
        // Обработка разрыва соединения
        emitter.onCompletion(() -> {
            System.out.println("✅ User " + userId + " connection completed");
            userEmitters.remove(userId);
        });
        emitter.onTimeout(() -> {
            System.out.println("⏱️ User " + userId + " connection timeout");
            userEmitters.remove(userId);
        });
        emitter.onError(throwable -> {
            System.out.println("❌ User " + userId + " connection error: " + throwable.getMessage());
            userEmitters.remove(userId);
        });
        
        return emitter;
    }

    /**
     * Подписка на события конкретного проекта
     */
    public SseEmitter subscribeToProject(Long projectId) {
        System.out.println("📡 Subscribing to project " + projectId + " events");
        
        SseEmitter emitter = new SseEmitter(TIMEOUT);
        projectEmitters.computeIfAbsent(projectId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        
        emitter.onCompletion(() -> {
            System.out.println("✅ Project " + projectId + " subscription completed");
            projectEmitters.get(projectId).remove(emitter);
        });
        emitter.onTimeout(() -> {
            System.out.println("⏱️ Project " + projectId + " subscription timeout");
            projectEmitters.get(projectId).remove(emitter);
        });
        emitter.onError(throwable -> {
            System.out.println("❌ Project " + projectId + " subscription error");
            projectEmitters.get(projectId).remove(emitter);
        });
        
        return emitter;
    }

    /**
     * Подписка на события конкретной подгруппы
     */
    public SseEmitter subscribeToSubgroup(Long subgroupId) {
        System.out.println("📡 Subscribing to subgroup " + subgroupId + " events");
        
        SseEmitter emitter = new SseEmitter(TIMEOUT);
        subgroupEmitters.computeIfAbsent(subgroupId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        
        emitter.onCompletion(() -> {
            System.out.println("✅ Subgroup " + subgroupId + " subscription completed");
            subgroupEmitters.get(subgroupId).remove(emitter);
        });
        emitter.onTimeout(() -> {
            System.out.println("⏱️ Subgroup " + subgroupId + " subscription timeout");
            subgroupEmitters.get(subgroupId).remove(emitter);
        });
        emitter.onError(throwable -> {
            System.out.println("❌ Subgroup " + subgroupId + " subscription error");
            subgroupEmitters.get(subgroupId).remove(emitter);
        });
        
        return emitter;
    }

    /**
     * Отправить событие о изменении списка проектов
     */
    public void notifyProjectsListChanged(Long userId) {
        System.out.println("📢 Notifying user " + userId + " about projects list change");
        
        SseEmitter emitter = userEmitters.get(userId);
        if (emitter != null) {
            try {
                emitter.send(SseEmitter.event()
                        .id(UUID.randomUUID().toString())
                        .name("projects-changed")
                        .data(new Object() {
                            public String action = "changed";
                            public Long userId_field = userId;
                            public long timestamp = System.currentTimeMillis();
                        })
                        .build());
                System.out.println("✅ Projects change notification sent to user " + userId);
            } catch (IOException e) {
                System.out.println("❌ Failed to send projects change notification to user " + userId);
                userEmitters.remove(userId);
            }
        }
    }

    /**
     * Отправить событие о получении уведомления
     */
    public void notifyNotificationReceived(Long userId, Object notification) {
        System.out.println("📢 Notifying user " + userId + " about new notification");
        
        SseEmitter emitter = userEmitters.get(userId);
        if (emitter != null) {
            try {
                emitter.send(SseEmitter.event()
                        .id(UUID.randomUUID().toString())
                        .name("notification-received")
                        .data(new Object() {
                            public Object notification_field = notification;
                            public long timestamp = System.currentTimeMillis();
                        })
                        .build());
                System.out.println("✅ Notification received event sent to user " + userId);
            } catch (IOException e) {
                System.out.println("❌ Failed to send notification received event to user " + userId);
                userEmitters.remove(userId);
            }
        }
    }

    /**
     * Отправить событие о изменении списка подгрупп в проекте
     */
    public void notifySubgroupsChanged(Long projectId) {
        System.out.println("📢 Notifying about subgroups change in project " + projectId);
        
        List<SseEmitter> emitters = projectEmitters.get(projectId);
        if (emitters != null) {
            for (SseEmitter emitter : new ArrayList<>(emitters)) {
                try {
                    emitter.send(SseEmitter.event()
                            .id(UUID.randomUUID().toString())
                            .name("subgroups-changed")
                            .data(new Object() {
                                public String action = "changed";
                                public Long projectId_field = projectId;
                                public long timestamp = System.currentTimeMillis();
                            })
                            .build());
                } catch (IOException e) {
                    System.out.println("❌ Failed to send subgroups change notification");
                    emitters.remove(emitter);
                }
            }
            System.out.println("✅ Subgroups change notification sent to project " + projectId);
        }
    }

    /**
     * Отправить событие об обновлении задачи
     */
    public void notifyTaskUpdated(Long subgroupId, Object taskData) {
        System.out.println("📢 Notifying about task update in subgroup " + subgroupId);
        
        List<SseEmitter> emitters = subgroupEmitters.get(subgroupId);
        if (emitters != null) {
            for (SseEmitter emitter : new ArrayList<>(emitters)) {
                try {
                    emitter.send(SseEmitter.event()
                            .id(UUID.randomUUID().toString())
                            .name("task-updated")
                            .data(new Object() {
                                public String action = "updated";
                                public Object task = taskData;
                                public long timestamp = System.currentTimeMillis();
                            })
                            .build());
                } catch (IOException e) {
                    System.out.println("❌ Failed to send task update notification");
                    emitters.remove(emitter);
                }
            }
            System.out.println("✅ Task update notification sent to subgroup " + subgroupId);
        }
    }

    /**
     * Отправить событие об удалении задачи
     */
    public void notifyTaskDeleted(Long subgroupId, Long taskId) {
        System.out.println("📢 Notifying about task deletion in subgroup " + subgroupId);
        
        List<SseEmitter> emitters = subgroupEmitters.get(subgroupId);
        if (emitters != null) {
            for (SseEmitter emitter : new ArrayList<>(emitters)) {
                try {
                    emitter.send(SseEmitter.event()
                            .id(UUID.randomUUID().toString())
                            .name("task-deleted")
                            .data(new Object() {
                                public String action = "deleted";
                                public Long taskId_field = taskId;
                                public long timestamp = System.currentTimeMillis();
                            })
                            .build());
                } catch (IOException e) {
                    System.out.println("❌ Failed to send task delete notification");
                    emitters.remove(emitter);
                }
            }
            System.out.println("✅ Task delete notification sent to subgroup " + subgroupId);
        }
    }

    /**
     * Отправить событие что пользователя удалили из проекта (автоматическое удаление с доски)
     */
    public void notifyUserRemovedFromProject(Long userId, Long projectId) {
        System.out.println("📢 Notifying user " + userId + " they were removed from project " + projectId);
        
        SseEmitter emitter = userEmitters.get(userId);
        if (emitter != null) {
            try {
                emitter.send(SseEmitter.event()
                        .id(UUID.randomUUID().toString())
                        .name("project-removed")
                        .data(new Object() {
                            public String action = "removed";
                            public Long projectId_field = projectId;
                            public String message = "Вас исключили из проекта";
                            public long timestamp = System.currentTimeMillis();
                        })
                        .build());
                System.out.println("✅ Project removed notification sent to user " + userId);
            } catch (IOException e) {
                System.out.println("❌ Failed to send project removed notification to user " + userId);
                userEmitters.remove(userId);
            }
        }
    }
}
