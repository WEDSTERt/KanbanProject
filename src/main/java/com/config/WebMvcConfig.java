package com.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import java.time.Duration;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Autowired
    private ResponseCacheInterceptor responseCacheInterceptor;

    /**
     * ✅ RestTemplate для HTTP запросов (используется для GitHub API и Telegram Bot)
     * С таймаутами для надежности
     */
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
            .setConnectTimeout(Duration.ofSeconds(5))
            .setReadTimeout(Duration.ofSeconds(10))
            .build();
    }

    /**
     * Register the response cache interceptor for all requests.
     * This ensures HTTP cache headers are added consistently.
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(responseCacheInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/error", "/health");
    }
}
