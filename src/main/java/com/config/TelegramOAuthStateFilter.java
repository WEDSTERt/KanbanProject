package com.config;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

/**
 * ✅ EARLIEST FILTER: Intercept Telegram OAuth state parameter
 * This runs at the VERY START of filter chain, before Spring OAuth2
 * 
 * @Order(Ordered.HIGHEST_PRECEDENCE) ensures it runs before ANY other filter
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TelegramOAuthStateFilter implements Filter {

    private static final Logger logger = LoggerFactory.getLogger(TelegramOAuthStateFilter.class);

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        
        if (!(request instanceof HttpServletRequest) || !(response instanceof HttpServletResponse)) {
            chain.doFilter(request, response);
            return;
        }
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        String requestURI = httpRequest.getRequestURI();
        String queryString = httpRequest.getQueryString();
        
        // Only log OAuth-related requests
        if (requestURI.contains("/oauth") || requestURI.contains("/login")) {
            logger.info("🔍 TelegramOAuthStateFilter - {} {}", 
                requestURI, 
                queryString != null ? "?" + queryString : "");
        }
        
        // ✅ INTERCEPT: /oauth2/authorization/* requests
        if (requestURI.contains("/oauth2/authorization/")) {
            logger.info("🔐 INTERCEPTED OAuth2 authorization: {}", requestURI);
            
            String customState = extractState(httpRequest);
            
            if (customState != null && customState.startsWith("tg_")) {
                logger.info("✅ FOUND TELEGRAM STATE: {}", customState);
                
                // Force session creation and save state
                HttpSession session = httpRequest.getSession(true);
                session.setAttribute("oauth_custom_state", customState);
                logger.info("✅ SAVED to session ID: {} (state: {})", 
                    session.getId(), customState);
                
                // Backup: save to cookie
                Cookie cookie = new Cookie("oauth_custom_state", customState);
                cookie.setMaxAge(600);
                cookie.setPath("/");
                cookie.setHttpOnly(true);
                httpResponse.addCookie(cookie);
                logger.info("✅ SAVED to cookie as backup");
            } else {
                logger.warn("⚠️ State parameter invalid or missing: {}", customState);
            }
        }
        
        // ✅ INTERCEPT: /login/oauth2/code/* callbacks
        if (requestURI.contains("/login/oauth2/code/")) {
            logger.info("🔐 INTERCEPTED OAuth2 callback: {}", requestURI);
            
            HttpSession session = httpRequest.getSession(false);
            if (session != null) {
                String savedState = (String) session.getAttribute("oauth_custom_state");
                logger.info("📋 RETRIEVED from session: {} (state: {})", 
                    session.getId(), savedState);
            } else {
                logger.warn("⚠️ NO session found for callback");
            }
        }
        
        // Continue filter chain
        chain.doFilter(request, response);
    }
    
    /**
     * Extract state parameter from request
     */
    private String extractState(HttpServletRequest request) {
        try {
            // Try method 1: request.getParameter() - Spring parsed
            String state = request.getParameter("state");
            if (state != null) {
                logger.debug("   Found state via getParameter: {}", state);
                return state;
            }
            
            // Try method 2: manual query string parsing
            String queryString = request.getQueryString();
            if (queryString != null && queryString.contains("state=")) {
                String[] params = queryString.split("&");
                for (String param : params) {
                    if (param.startsWith("state=")) {
                        state = param.substring(6);
                        state = URLDecoder.decode(state, StandardCharsets.UTF_8);
                        logger.debug("   Found state via query string: {}", state);
                        return state;
                    }
                }
            }
            
            logger.debug("   State not found in request");
            return null;
            
        } catch (Exception e) {
            logger.error("Error extracting state: {}", e.getMessage());
            return null;
        }
    }
}
