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
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;

@Component
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final Logger logger = LoggerFactory.getLogger(OAuth2LoginSuccessHandler.class);

    private final UserService userService;
    private final JwtUtil jwtUtil;

    @Value("${app.frontend.url}")
    private String frontendUrl;

    public OAuth2LoginSuccessHandler(UserService userService, JwtUtil jwtUtil) {
        this.userService = userService;
        this.jwtUtil = jwtUtil;
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
                email = oAuth2User.getAttribute("email");
                fullName = oAuth2User.getAttribute("name");
                String login = oAuth2User.getAttribute("login");
                
                if (email == null || email.isEmpty()) {
                    email = login + "@github.com";
                }
                if (fullName == null || fullName.isEmpty()) {
                    fullName = login;
                }
                logger.info("GitHub user: {}, {}", email, fullName);
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
}
