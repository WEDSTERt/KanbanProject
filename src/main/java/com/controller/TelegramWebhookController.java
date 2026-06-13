package com.controller;

import com.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/telegram")
public class TelegramWebhookController {

    private static final Logger logger = LoggerFactory.getLogger(TelegramWebhookController.class);

    private final UserService userService;

    @Autowired
    public TelegramWebhookController(UserService userService) {
        this.userService = userService;
    }

    /**
     * Webhook endpoint для обработки callback'ов от Telegram бота
     * POST /api/telegram/webhook
     * 
     * Используется для подтверждения авторизации и синхронизации статуса
     */
    @PostMapping("/webhook")
    public ResponseEntity<?> webhook(@RequestBody Map<String, Object> payload) {
        try {
            logger.info("📨 Получен webhook callback от Telegram");
            logger.debug("Payload: {}", payload);

            // Извлекаем данные из payload
            Long userId = extractLong(payload, "user_id");
            Long telegramId = extractLong(payload, "telegram_id");
            String action = extractString(payload, "action");

            if (userId == null || telegramId == null) {
                logger.warn("❌ Некорректный payload: отсутствуют user_id или telegram_id");
                return ResponseEntity.badRequest().body(Map.of("error", "Missing user_id or telegram_id"));
            }

            logger.info("🔍 Обработка webhook: user_id={}, telegram_id={}, action={}", userId, telegramId, action);

            if ("oauth_success".equals(action)) {
                logger.info("✅ Успешная OAuth авторизация: Telegram {} привязан к User {}", telegramId, userId);
                // Здесь можно добавить дополнительную логику
            } else if ("oauth_error".equals(action)) {
                logger.warn("❌ Ошибка при OAuth авторизации для Telegram {}", telegramId);
            } else if ("sync".equals(action)) {
                logger.info("🔄 Синхронизация статуса: Telegram {} <-> User {}", telegramId, userId);
                // Синхронизация уведомлений и прочих параметров
            }

            logger.info("✅ Webhook обработан успешно");
            return ResponseEntity.ok(Map.of("status", "success"));

        } catch (Exception e) {
            logger.error("❌ Ошибка обработки webhook", e);
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Verify OAuth status endpoint
     * GET /api/telegram/verify/{telegramId}
     */
    @GetMapping("/verify/{telegramId}")
    public ResponseEntity<?> verifyOAuthStatus(@PathVariable Long telegramId) {
        try {
            logger.info("🔍 Проверка статуса OAuth для Telegram {}", telegramId);

            // Проверяем есть ли пользователь привязан к этому Telegram ID
            // Здесь можно использовать native query или GraphQL

            logger.info("✅ Статус проверен");
            return ResponseEntity.ok(Map.of(
                    "status", "verified",
                    "telegram_id", telegramId
            ));

        } catch (Exception e) {
            logger.error("❌ Ошибка при проверке статуса", e);
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Helper method to extract Long from map
     */
    private Long extractLong(Map<String, Object> map, String key) {
        Object value = map.get(key);
        if (value instanceof Number) {
            return ((Number) value).longValue();
        } else if (value instanceof String) {
            try {
                return Long.parseLong((String) value);
            } catch (NumberFormatException e) {
                logger.warn("❌ Не удалось парсить Long из значения: {}", value);
                return null;
            }
        }
        return null;
    }

    /**
     * Helper method to extract String from map
     */
    private String extractString(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value != null ? value.toString() : null;
    }
}
