package com.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

@Configuration
public class CloudflareConfig {

    /**
     * Фильтр для обработки Cloudflare headers
     * Cloudflare добавляет CF-Connecting-IP который содержит реальный IP клиента
     */
    @Bean
    public FilterRegistrationBean<CloudflareHeaderFilter> cloudflareFilter() {
        FilterRegistrationBean<CloudflareHeaderFilter> registrationBean = new FilterRegistrationBean<>();
        registrationBean.setFilter(new CloudflareHeaderFilter());
        registrationBean.addUrlPatterns("/*");
        registrationBean.setOrder(1);
        return registrationBean;
    }

    public static class CloudflareHeaderFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
                throws ServletException, IOException {
            String cfConnectingIp = request.getHeader("CF-Connecting-IP");
            String cfRay = request.getHeader("CF-RAY");
            String cfCountry = request.getHeader("CF-IPCountry");

            if (cfConnectingIp != null) {
                // Обёртываем request чтобы вернуть правильный IP
                HttpServletRequest wrappedRequest = new HttpServletRequestWrapper(request) {
                    @Override
                    public String getRemoteAddr() {
                        return cfConnectingIp;
                    }

                    @Override
                    public String getHeader(String name) {
                        if ("X-Forwarded-For".equalsIgnoreCase(name)) {
                            return cfConnectingIp;
                        }
                        return super.getHeader(name);
                    }
                };
                filterChain.doFilter(wrappedRequest, response);
            } else {
                filterChain.doFilter(request, response);
            }
        }
    }
}
