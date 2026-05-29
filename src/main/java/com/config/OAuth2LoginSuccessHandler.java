package com.config;

import com.entity.User;
import com.service.UserService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.Map;

@Component
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final Logger logger = LoggerFactory.getLogger(OAuth2LoginSuccessHandler.class);

    private final UserService userService;
    private final JwtUtil jwtUtil;
    private final RestTemplate restTemplate;
    private final OAuth2AuthorizedClientService authorizedClientService;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    public OAuth2LoginSuccessHandler(UserService userService, JwtUtil jwtUtil, RestTemplate restTemplate,
                                     OAuth2AuthorizedClientService authorizedClientService) {
        this.userService = userService;
        this.jwtUtil = jwtUtil;
        this.restTemplate = restTemplate;
        this.authorizedClientService = authorizedClientService;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        try {
            logger.info("=== OAuth2LoginSuccessHandler START ===");

            OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
            OAuth2User oAuth2User = token.getPrincipal();
            String registrationId = token.getAuthorizedClientRegistrationId();
            logger.info("Provider: {}", registrationId);

            String email;
            String fullName;

            if ("google".equals(registrationId)) {
                email = oAuth2User.getAttribute("email");
                fullName = oAuth2User.getAttribute("name");
                logger.info("Google user: {}, {}", email, fullName);
            } else if ("yandex".equals(registrationId)) {
                Map<String, Object> attributes = oAuth2User.getAttributes();
                email = (String) attributes.get("default_email");
                fullName = (String) attributes.get("real_name");
                if (fullName == null) fullName = (String) attributes.get("display_name");
                logger.info("Yandex user: {}, {}", email, fullName);
            } else if ("github".equals(registrationId)) {
                // ✅ ИСПРАВЛЕНО: Получаем реальный email от GitHub API
                String login = oAuth2User.getAttribute("login");
                
                // Получаем access token
                OAuth2AuthorizedClient authorizedClient = authorizedClientService.loadAuthorizedClient(
                    registrationId, 
                    token.getName()
                );
                
                String accessToken = null;
                if (authorizedClient != null && authorizedClient.getAccessToken() != null) {
                    accessToken = authorizedClient.getAccessToken().getTokenValue();
                }
                
                // Пытаемся получить email через API
                email = getGitHubEmail(accessToken);
                fullName = oAuth2User.getAttribute("name");
                
                if (email == null || email.isEmpty()) {
                    email = login + "@github.com";
                }
                if (fullName == null || fullName.isEmpty()) {
                    fullName = login;
                }
                logger.info("GitHub user: {}, {} (login: {})", email, fullName, login);
            } else {
                throw new RuntimeException("Unsupported provider: " + registrationId);
            }

            // Находим или создаём пользователя
            User user = userService.findOrCreateOAuthUser(email, fullName, registrationId);
            if (user == null) {
                throw new RuntimeException("User could not be created or found");
            }
            logger.info("User ID: {}", user.getId());

            // Генерируем JWT
            String jwt = jwtUtil.generateToken(user.getId(), user.getEmail());
            if (jwt == null || jwt.isEmpty()) {
                throw new RuntimeException("JWT generation failed");
            }
            logger.info("JWT generated successfully");

            // Возвращаем HTML страницу со встроенным скриптом
            String htmlResponse = "<!DOCTYPE html>\n" +
                    "<html>\n" +
                    "<head>\n" +
                    "  <title>Redirecting...</title>\n" +
                    "</head>\n" +
                    "<body>\n" +
                    "  <script>\n" +
                    "    (function() {\n" +
                    "      const token = '" + jwt.replace("'", "\\'") + "';\n" +
                    "      console.log('OAuth2 handler: Saving token to localStorage');\n" +
                    "      localStorage.setItem('jwtToken', token);\n" +
                    "      console.log('Token saved, redirecting to home');\n" +
                    "      window.location.href = '/';\n" +
                    "    })();\n" +
                    "  </script>\n" +
                    "  <p>Redirecting...</p>\n" +
                    "</body>\n" +
                    "</html>";

            response.setContentType("text/html; charset=UTF-8");
            response.setStatus(HttpServletResponse.SC_OK);
            response.getWriter().write(htmlResponse);
            response.getWriter().flush();

            logger.info("=== OAuth2LoginSuccessHandler SUCCESS ===");

        } catch (Exception e) {
            logger.error("OAuth2LoginSuccessHandler ERROR: {}", e.getMessage(), e);
            try {
                response.sendRedirect(frontendUrl + "/login?oauth_error=1");
            } catch (IOException ex) {
                logger.error("Failed to redirect on error", ex);
            }
        }
    }

    /**
     * ✅ НОВОЕ: Получает реальный email пользователя от GitHub API
     * GitHub по умолчанию не возвращает email через OAuth2,
     * нужно запросить через /user/emails endpoint
     */
    private String getGitHubEmail(String accessToken) {
        try {
            if (accessToken == null || accessToken.isEmpty()) {
                logger.warn("❌ No access token provided");
                return null;
            }
            
            logger.info("📧 Fetching GitHub user emails via API...");
            
            // Создаём простой HTTP запрос с заголовками
            org.springframework.http.HttpHeaders httpHeaders = new org.springframework.http.HttpHeaders();
            httpHeaders.set("Authorization", "Bearer " + accessToken);
            httpHeaders.set("Accept", "application/vnd.github.v3+json");
            
            org.springframework.http.HttpEntity<String> entity = new org.springframework.http.HttpEntity<>(httpHeaders);
            
            org.springframework.http.ResponseEntity<java.util.Map[]> response = restTemplate.exchange(
                "https://api.github.com/user/emails",
                org.springframework.http.HttpMethod.GET,
                entity,
                java.util.Map[].class
            );
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                java.util.Map[] emails = response.getBody();
                logger.info("📧 Found {} email(s) from GitHub", emails.length);
                
                // Ищем primary verified email
                for (java.util.Map email : emails) {
                    Boolean primary = (Boolean) email.get("primary");
                    Boolean verified = (Boolean) email.get("verified");
                    String emailAddress = (String) email.get("email");
                    
                    logger.info("   - {}: primary={}, verified={}", emailAddress, primary, verified);
                    
                    if (primary != null && primary && verified != null && verified) {
                        logger.info("✅ Using primary verified email: {}", emailAddress);
                        return emailAddress;
                    }
                }
                
                // Если primary не найден, берём первый verified
                for (java.util.Map email : emails) {
                    Boolean verified = (Boolean) email.get("verified");
                    String emailAddress = (String) email.get("email");
                    
                    if (verified != null && verified) {
                        logger.info("✅ Using first verified email: {}", emailAddress);
                        return emailAddress;
                    }
                }
                
                // Если ничего не найдено, берём любой
                if (emails.length > 0) {
                    String emailAddress = (String) emails[0].get("email");
                    logger.info("⚠️ No primary/verified email, using: {}", emailAddress);
                    return emailAddress;
                }
            }
            
            logger.warn("❌ Could not fetch GitHub emails");
            return null;
            
        } catch (Exception e) {
            logger.error("❌ Error fetching GitHub emails: {}", e.getMessage(), e);
            return null;
        }
    }
}
