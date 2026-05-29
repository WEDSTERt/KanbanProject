package com.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.TimeUnit;

@Configuration
public class HttpCacheConfig implements WebMvcConfigurer {

    /**
     * Configure HTTP caching headers for static resources and API responses.
     * 
     * Strategy:
     * - Static files (CSS, JS): 30 days cache
     * - Images: 7 days cache
     * - API responses: Set via response headers (see ResponseCacheInterceptor)
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // CSS, JavaScript, Fonts - long-term cache (30 days)
        registry.addResourceHandler("/static/css/**", "/static/js/**", "/static/fonts/**")
                .addResourceLocations("classpath:/static/css/", "classpath:/static/js/", "classpath:/static/fonts/")
                .setCacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic())
                .resourceChain(true);

        // Images - 7 days cache
        registry.addResourceHandler("/static/images/**")
                .addResourceLocations("classpath:/static/images/")
                .setCacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic())
                .resourceChain(true);

        // HTML files - No cache (always fetch fresh)
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/")
                .setCacheControl(CacheControl.noCache().mustRevalidate())
                .resourceChain(true);
    }
}
