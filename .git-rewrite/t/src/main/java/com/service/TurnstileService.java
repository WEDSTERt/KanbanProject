package com.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.Map;

@Service
public class TurnstileService {

    @Value("${turnstile.secret.key:}")
    private String secretKey;

    private final WebClient webClient;

    public TurnstileService() {
        this.webClient = WebClient.builder()
                .baseUrl("https://challenges.cloudflare.com")
                .defaultHeader("Content-Type", "application/x-www-form-urlencoded")
                .build();
    }

    public boolean verifyToken(String token, String clientIp) {
        System.out.println("🔐 === TURNSTILE VERIFICATION ===");
        System.out.println("Token: " + (token != null ? token.substring(0, Math.min(30, token.length())) + "..." : "null"));
        System.out.println("Client IP: " + clientIp);

        // Тестовый ключ всегда успешен
        if ("1x00000000000000000000AA".equals(token)) {
            System.out.println("✅ Test Turnstile token accepted");
            return true;
        }

        if (token == null || token.isEmpty()) {
            System.err.println("❌ Turnstile token is empty");
            return false;
        }

        if (secretKey == null || secretKey.isEmpty()) {
            System.err.println("⚠️ Turnstile secret key not configured!");
            return false;
        }

        try {
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("secret", secretKey);
            formData.add("response", token);
            if (clientIp != null && !clientIp.isEmpty()) {
                formData.add("remoteip", clientIp);
            }

            System.out.println("📤 Sending verification to Cloudflare...");

            @SuppressWarnings("unchecked")
            Map<String, Object> response = webClient.post()
                    .uri("/turnstile/v0/siteverify")
                    .bodyValue(formData)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            System.out.println("📥 Cloudflare response: " + response);

            boolean success = response != null && Boolean.TRUE.equals(response.get("success"));
            if (success) {
                System.out.println("✅ Turnstile verification successful");
            } else if (response != null && response.get("error-codes") != null) {
                System.err.println("❌ Turnstile errors: " + response.get("error-codes"));
            }
            return success;
        } catch (Exception e) {
            System.err.println("❌ Turnstile error: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
}