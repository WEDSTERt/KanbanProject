package com.config;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.concurrent.TimeUnit;

/**
 * Intercepts GraphQL and REST API responses to add appropriate HTTP cache headers.
 * 
 * Cache Strategy by Endpoint:
 * - /graphql: No cache (always fresh, user-specific)
 * - /api/export/*: No cache (generated on-the-fly)
 * - /api/files/*: 7 days cache (file content is immutable)
 * - /api/projects/* (GET): 5 minutes cache (project lists change infrequently)
 * - /api/tasks/* (GET): 2 minutes cache (tasks change frequently)
 */
@Component
public class ResponseCacheInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String requestUri = request.getRequestURI();
        String method = request.getMethod();

        // Only set cache headers for GET requests
        if (!method.equalsIgnoreCase("GET")) {
            setCacheHeaders(response, CacheControl.noCache().mustRevalidate());
            return true;
        }

        // GraphQL: No cache (real-time data, user-specific queries)
        if (requestUri.startsWith("/graphql")) {
            setCacheHeaders(response, CacheControl.noCache()
                    .mustRevalidate()
                    .proxyRevalidate());
            return true;
        }

        // File downloads: Cache for 7 days (immutable content)
        if (requestUri.startsWith("/api/files/")) {
            setCacheHeaders(response, CacheControl.maxAge(7, TimeUnit.DAYS)
                    .cachePublic()
                    .immutable());
            return true;
        }

        // Export endpoints: No cache (generated on-the-fly)
        if (requestUri.startsWith("/api/export/")) {
            setCacheHeaders(response, CacheControl.noCache().mustRevalidate());
            return true;
        }

        // Project lists/details: Cache for 5 minutes
        if (requestUri.startsWith("/api/projects/")) {
            setCacheHeaders(response, CacheControl.maxAge(5, TimeUnit.MINUTES)
                    .cachePublic());
            return true;
        }

        // Task operations: Cache for 2 minutes (frequently changing)
        if (requestUri.startsWith("/api/tasks/")) {
            setCacheHeaders(response, CacheControl.maxAge(2, TimeUnit.MINUTES)
                    .cachePublic());
            return true;
        }

        // Default: No cache for other endpoints
        setCacheHeaders(response, CacheControl.noCache().mustRevalidate());
        return true;
    }

    private void setCacheHeaders(HttpServletResponse response, CacheControl cacheControl) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, cacheControl.getHeaderValue());
        
        // Add ETag support for validation
        response.setHeader(HttpHeaders.VARY, "Accept-Encoding, Authorization");
        
        // Add security headers
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "SAMEORIGIN");
    }
}
