package com.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
public class CacheConfig {

    /**
     * Caffeine Cache Manager - in-memory, high-performance caching
     * 
     * Cache Tiers:
     * 1. SHORT_TERM (5 min) - Frequently changing data (current user, notifications)
     * 2. MEDIUM_TERM (20 min) - User data, project members, tags
     * 3. LONG_TERM (60 min) - Project lists, stable references
     */
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager(
                "projects",
                "projectDetails",
                "subgroups",
                "tasksBySubgroup",
                "tasksByAssignee",
                "tasksByIds",
                "users",
                "currentUser",
                "projectMembers",
                "subgroupMembers",
                "tags",
                "attachments"
        );
        
        // Configure default settings
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(20, TimeUnit.MINUTES)
                .maximumSize(5000)
                .recordStats()
        );

        return cacheManager;
    }

    /**
     * Cache Specifications by Use Case:
     * 
     * PROJECTS & GROUPS (15 min):
     *   - projects (user's projects list)
     *   - projectDetails (single project with members)
     *   - subgroups (subgroups in a project)
     * 
     * TASKS (10 min - volatile, frequently modified):
     *   - tasksBySubgroup (tasks within a subgroup)
     *   - tasksByAssignee (user's assigned tasks)
     *   - tasksByIds (batch task retrieval)
     * 
     * USERS (20 min):
     *   - currentUser (authenticated user profile)
     *   - users (user references)
     * 
     * METADATA (30 min):
     *   - projectMembers (members list)
     *   - subgroupMembers (members list)
     *   - tags (task tags/categories)
     *   - attachments (file metadata)
     */
}
