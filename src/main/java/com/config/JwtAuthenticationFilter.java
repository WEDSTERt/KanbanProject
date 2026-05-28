package com.config;

import com.service.CustomUserDetailsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    private final JwtUtil jwtUtil;
    private final CustomUserDetailsService userDetailsService;

    public JwtAuthenticationFilter(JwtUtil jwtUtil, CustomUserDetailsService userDetailsService) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        try {
            String token = null;
            Long userId = null;

            // 1️⃣ Проверяем Authorization header (Bearer token)
            final String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                token = authHeader.substring(7);
                if (!token.trim().isEmpty() && jwtUtil.validateToken(token)) {
                    userId = jwtUtil.extractUserId(token);
                }
            }

            // 2️⃣ Если токена в header нет, проверяем query parameter (для SSE/EventSource)
            // EventSource не поддерживает custom headers, поэтому используем query param
            if (userId == null) {
                token = request.getParameter("token");
                if (token != null && !token.trim().isEmpty() && jwtUtil.validateToken(token)) {
                    userId = jwtUtil.extractUserId(token);
                    System.out.println("✅ JWT extracted from query parameter for user: " + userId);
                }
            }

            if (userId != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                try {
                    UserDetails userDetails = userDetailsService.loadUserByUsername(userId.toString());
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                } catch (UsernameNotFoundException e) {
                    logger.warn("User with id {} not found, skipping authentication", userId);
                }
            }
        } catch (Exception e) {
            logger.warn("JWT parsing error: {}", e.getMessage());
        }
        chain.doFilter(request, response);
    }
}
