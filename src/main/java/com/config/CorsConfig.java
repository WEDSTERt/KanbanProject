package com.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/graphql")
                .allowedOrigins(
                    "https://kanbandocky.ru",
                    "http://localhost:3000",
                    "http://localhost:5173",
                    "https://pitilessly-tidy-louse.cloudpub.ru",
                    "https://pitifully-holy-turbot.cloudpub.ru"
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);

        registry.addMapping("/subscriptions")
                .allowedOrigins(
                    "https://kanbandocky.ru",
                    "http://localhost:3000",
                    "http://localhost:5173",
                    "https://pitilessly-tidy-louse.cloudpub.ru",
                    "https://pitifully-holy-turbot.cloudpub.ru"
                )
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);

        // Для всех остальных путей API
        registry.addMapping("/api/**")
                .allowedOrigins(
                    "https://kanbandocky.ru",
                    "http://localhost:3000",
                    "http://localhost:5173",
                    "https://pitilessly-tidy-louse.cloudpub.ru",
                    "https://pitifully-holy-turbot.cloudpub.ru"
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);

        // OAuth2 endpoints
        registry.addMapping("/oauth2/**")
                .allowedOrigins(
                    "https://kanbandocky.ru",
                    "http://localhost:3000",
                    "http://localhost:5173",
                    "https://pitilessly-tidy-louse.cloudpub.ru",
                    "https://pitifully-holy-turbot.cloudpub.ru"
                )
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);

        // Login endpoints
        registry.addMapping("/login/**")
                .allowedOrigins(
                    "https://kanbandocky.ru",
                    "http://localhost:3000",
                    "http://localhost:5173",
                    "https://pitilessly-tidy-louse.cloudpub.ru",
                    "https://pitifully-holy-turbot.cloudpub.ru"
                )
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
