package com.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import com.config.JwtUtil;

/**
 * REST контроллер для подключения к SSE каналам
 */
@RestController
@RequestMapping("/api/sse")
public class SseController {

    private final TaskSSEController sseController;
    private final JwtUtil jwtUtil;

    @Autowired
    public SseController(TaskSSEController sseController, JwtUtil jwtUtil) {
        this.sseController = sseController;
        this.jwtUtil = jwtUtil;
    }

    /**
     * Аутентифицировать пользователя по JWT token из query параметра
     */
    private void authenticateFromToken(String token) {
        if (token != null && !token.isEmpty()) {
            try {
                Long userId = jwtUtil.extractUserId(token);
                if (userId != null) {
                    Authentication auth = new UsernamePasswordAuthenticationToken(
                        userId.toString(), null, java.util.Collections.emptyList()
                    );
                    SecurityContextHolder.getContext().setAuthentication(auth);
                    System.out.println("✅ SSE authenticated user from token: " + userId);
                }
            } catch (Exception e) {
                System.out.println("⚠️ Failed to authenticate SSE from token: " + e.getMessage());
            }
        }
    }

    /**
     * Подписка на глобальные события (проекты, уведомления)
     * GET /api/sse/subscribe/{userId}?token=JWT_TOKEN
     */
    @GetMapping("/subscribe/{userId}")
    public SseEmitter subscribe(@PathVariable Long userId, @RequestParam(required = false) String token) {
        authenticateFromToken(token);
        System.out.println("🔌 SSE connection request from user " + userId);
        return sseController.subscribe(userId);
    }

    /**
     * Подписка на события проекта
     * GET /api/sse/subscribe-project/{projectId}?token=JWT_TOKEN
     */
    @GetMapping("/subscribe-project/{projectId}")
    public SseEmitter subscribeToProject(@PathVariable Long projectId, @RequestParam(required = false) String token) {
        authenticateFromToken(token);
        System.out.println("🔌 SSE connection request for project " + projectId);
        return sseController.subscribeToProject(projectId);
    }

    /**
     * Подписка на события подгруппы (задачи)
     * GET /api/sse/subscribe-subgroup/{subgroupId}?token=JWT_TOKEN
     */
    @GetMapping("/subscribe-subgroup/{subgroupId}")
    public SseEmitter subscribeToSubgroup(@PathVariable Long subgroupId, @RequestParam(required = false) String token) {
        authenticateFromToken(token);
        System.out.println("🔌 SSE connection request for subgroup " + subgroupId);
        return sseController.subscribeToSubgroup(subgroupId);
    }
}


