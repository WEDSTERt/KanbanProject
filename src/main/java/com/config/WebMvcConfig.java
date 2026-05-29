package com.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Autowired
    private ResponseCacheInterceptor responseCacheInterceptor;

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
