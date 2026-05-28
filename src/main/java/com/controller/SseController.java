package com.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * REST контроллер для подключения к SSE каналам
 */
@RestController
@RequestMapping("/api/sse")
public class SseController {

    private final TaskSSEController sseController;

    @Autowired
    public SseController(TaskSSEController sseController) {
        this.sseController = sseController;
    }

    /**
     * Подписка на глобальные события (проекты, уведомления)
     * GET /api/sse/subscribe/{userId}?token=JWT_TOKEN
     */
    @GetMapping("/subscribe/{userId}")
    @PreAuthorize("isAuthenticated()")
    public SseEmitter subscribe(@PathVariable Long userId) {
        System.out.println("🔌 SSE connection request from user " + userId);
        return sseController.subscribe(userId);
    }

    /**
     * Подписка на события проекта
     * GET /api/sse/subscribe-project/{projectId}?token=JWT_TOKEN
     */
    @GetMapping("/subscribe-project/{projectId}")
    @PreAuthorize("isAuthenticated()")
    public SseEmitter subscribeToProject(@PathVariable Long projectId) {
        System.out.println("🔌 SSE connection request for project " + projectId);
        return sseController.subscribeToProject(projectId);
    }

    /**
     * Подписка на события подгруппы (задачи)
     * GET /api/sse/subscribe-subgroup/{subgroupId}?token=JWT_TOKEN
     */
    @GetMapping("/subscribe-subgroup/{subgroupId}")
    @PreAuthorize("isAuthenticated()")
    public SseEmitter subscribeToSubgroup(@PathVariable Long subgroupId) {
        System.out.println("🔌 SSE connection request for subgroup " + subgroupId);
        return sseController.subscribeToSubgroup(subgroupId);
    }
}
