package com.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Контроллер для обслуживания фронтенд маршрутов.
 */
@Controller
@RequestMapping
public class FrontendController {

    /**
     * Для всех фронтенд маршрутов возвращаем index.html
     */
    @GetMapping({
        "/",
        "/login",
        "/register",
        "/verify-email",
        "/verify-email-pending",
        "/account",
        "/settings",
        "/board",
        "/{path:[^\\.]*}",
        "/{path:[^\\.]*}/{subpath:[^\\.]*}"
    })
    public String forwardToIndex(HttpServletRequest request) {
        String fullUrl = request.getRequestURL().toString();
        String queryString = request.getQueryString();
        String requestUri = request.getRequestURI();
        
        System.out.println("═══════════════════════════════════════════");
        System.out.println("📍 FrontendController intercepted request:");
        System.out.println("   Full URL: " + fullUrl);
        System.out.println("   Request URI: " + requestUri);
        System.out.println("   Query String: " + queryString);
        System.out.println("═══════════════════════════════════════════");
        
        if (queryString != null && !queryString.isEmpty()) {
            System.out.println("✅ Redirecting to /index.html?" + queryString);
            return "redirect:/index.html?" + queryString;
        }
        
        System.out.println("✅ Redirecting to /index.html");
        return "redirect:/index.html";
    }
}
