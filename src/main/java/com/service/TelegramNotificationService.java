package com.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.HttpServerErrorException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class TelegramNotificationService {
    
    private static final Logger logger = LoggerFactory.getLogger(TelegramNotificationService.class);
    
    @Value("${app.telegram.bot.url:}")
    private String telegramBotUrl;
    
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    
    // Параметры retry
    private static final int MAX_RETRIES = 5;  // Увеличено с 3 до 5
    private static final long RETRY_DELAY_MS = 2000;  // Увеличено с 1000 до 2000 ms (2 сек)
    
    public TelegramNotificationService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        logger.info("✅ TelegramNotificationService инициализирован");
    }
    
    /**
     * 📋 Отправить уведомление о проекте
     */
    public void notifyProjectEvent(String eventType, Long projectId, String projectName, 
                                   String description, String changes, List<Long> userIds) {
        try {
            logger.info("📤 Отправка уведомления о проекте: {} (ID: {})", projectName, projectId);
            
            Map<String, Object> payload = new HashMap<>();
            payload.put("event_type", eventType);
            payload.put("project_id", projectId);
            payload.put("project_name", projectName);
            if (description != null) {
                payload.put("description", description);
            }
            if (changes != null) {
                payload.put("changes", changes);
            }
            if (userIds != null && !userIds.isEmpty()) {
                payload.put("user_ids", userIds);
            }
            
            sendNotification("/api/notify/project", payload);
            logger.info("✅ Уведомление о проекте отправлено");
        } catch (Exception e) {
            logger.error("❌ Ошибка при отправке уведомления о проекте: {}", e.getMessage());
        }
    }
    
    /**
     * 👥 Отправить уведомление о группе
     */
    public void notifyGroupEvent(String eventType, Long projectId, String projectName,
                                Long groupId, String groupName, String description, List<Long> userIds) {
        try {
            logger.info("📤 Отправка уведомления о группе: {} (ID: {}) в проекте {}", 
                groupName, groupId, projectName);
            
            Map<String, Object> payload = new HashMap<>();
            payload.put("event_type", eventType);
            payload.put("project_id", projectId);
            payload.put("project_name", projectName);
            payload.put("group_id", groupId);
            payload.put("group_name", groupName);
            if (description != null) {
                payload.put("description", description);
            }
            if (userIds != null && !userIds.isEmpty()) {
                payload.put("user_ids", userIds);
            }
            
            sendNotification("/api/notify/group", payload);
            logger.info("✅ Уведомление о группе отправлено");
        } catch (Exception e) {
            logger.error("❌ Ошибка при отправке уведомления о группе: {}", e.getMessage());
        }
    }
    
    /**
     * ✅ Отправить уведомление о задаче
     */
    public void notifyTaskEvent(String eventType, Long projectId, String projectName,
                               Long groupId, String groupName, Long taskId, String title,
                               String priority, String oldStatus, String newStatus,
                               String dueDate, Integer daysOverdue, List<Long> userIds, String changes) {
        try {
            logger.info("📤 Отправка уведомления о задаче: {} (ID: {}) в группе {}", 
                title, taskId, groupName);
            
            Map<String, Object> payload = new HashMap<>();
            payload.put("event_type", eventType);
            payload.put("project_id", projectId);
            payload.put("project_name", projectName);
            payload.put("group_id", groupId);
            payload.put("group_name", groupName);
            payload.put("task_id", taskId);
            payload.put("title", title);
            
            if (priority != null) {
                payload.put("priority", priority);
            }
            if (oldStatus != null) {
                payload.put("old_status", oldStatus);
            }
            if (newStatus != null) {
                payload.put("new_status", newStatus);
            }
            if (dueDate != null) {
                payload.put("due_date", dueDate);
            }
            if (daysOverdue != null) {
                payload.put("days_overdue", daysOverdue);
            }
            if (changes != null) {
                payload.put("changes", changes);
            }
            if (userIds != null && !userIds.isEmpty()) {
                payload.put("user_ids", userIds);
            }
            
            sendNotification("/api/notify/task", payload);
            logger.info("✅ Уведомление о задаче отправлено");
        } catch (Exception e) {
            logger.error("❌ Ошибка при отправке уведомления о задаче: {}", e.getMessage());
        }
    }
    
    /**
     * Отправить HTTP запрос к Telegram боту (асинхронно в отдельном потоке с retry логикой)
     */
    private void sendNotification(String endpoint, Map<String, Object> payload) {
        try {
            // Проверяем что URL не пустой и валидный
            if (telegramBotUrl == null || telegramBotUrl.isBlank()) {
                logger.warn("⚠️ Telegram Bot URL не настроен. Переменная app.telegram.bot.url пуста.");
                logger.warn("   Добавьте в .env: app.telegram.bot.url=http://localhost:8001");
                logger.warn("   Или установите переменную окружения TELEGRAM_BOT_URL");
                return;
            }
            
            String url = telegramBotUrl + endpoint;
            logger.debug("🌐 POST {} с payload: {}", url, payload);
            
            // Отправляем асинхронно в отдельном потоке чтобы не блокировать основной поток
            new Thread(() -> {
                sendNotificationWithRetry(url, payload, 0);
            }).start();
            
        } catch (Exception e) {
            logger.error("❌ Ошибка при подготовке запроса: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Отправить запрос с retry логикой
     */
    private void sendNotificationWithRetry(String url, Map<String, Object> payload, int attempt) {
        try {
            logger.debug("📡 Попытка отправки #{}/{} на: {}", attempt + 1, MAX_RETRIES, url);
            String response = restTemplate.postForObject(url, payload, String.class);
            logger.debug("✅ Response получен успешно: {}", response);
            logger.info("📡 Telegram Bot API ответил успешно с первой попытки");
        } catch (HttpServerErrorException.ServiceUnavailable e) {
            // 503 - API еще инициализируется, нужно повторить
            logger.warn("⚠️ API не готов (503), попытка {}/{}", attempt + 1, MAX_RETRIES);
            if (attempt < MAX_RETRIES - 1) {
                logger.info("   ⏱️  Ожидание {}ms перед повтором...", RETRY_DELAY_MS);
                try {
                    Thread.sleep(RETRY_DELAY_MS);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    logger.error("❌ Прерывание во время ожидания retry");
                    return;
                }
                sendNotificationWithRetry(url, payload, attempt + 1);
            } else {
                logger.error("❌ API недоступен после {} попыток (503 Service Unavailable)", MAX_RETRIES);
            }
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            logger.error("❌ HTTP ошибка (код {}): {}", e.getRawStatusCode(), e.getMessage());
        } catch (org.springframework.web.client.HttpServerErrorException e) {
            logger.error("❌ Ошибка сервера Telegram (код {}): {}", e.getRawStatusCode(), e.getMessage());
        } catch (org.springframework.web.client.ResourceAccessException e) {
            logger.error("❌ Ошибка подключения к Telegram Bot: {} (URL: {})", e.getMessage(), url);
            logger.error("   Убедитесь что:");
            logger.error("   1. Telegram Bot контейнер запущен: docker ps | grep telegram");
            logger.error("   2. Порт 8001 опубликован: docker port telegram-bot-xray");
            logger.error("   3. URL правильный: {}", telegramBotUrl);
        } catch (RestClientException e) {
            logger.error("❌ REST Client ошибка: {}", e.getMessage());
        } catch (Exception e) {
            logger.error("❌ Неожиданная ошибка при отправке: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Проверка доступности Telegram бота
     */
    public boolean isAvailable() {
        try {
            if (telegramBotUrl == null || telegramBotUrl.isBlank()) {
                logger.warn("⚠️ Telegram Bot URL не настроен");
                return false;
            }
            
            logger.info("🔍 Проверка доступности Telegram бота: {}", telegramBotUrl);
            String url = telegramBotUrl + "/api/health";
            String response = restTemplate.getForObject(url, String.class);
            logger.info("✅ Telegram бот доступен. Response: {}", response);
            return true;
        } catch (org.springframework.web.client.ResourceAccessException e) {
            logger.warn("⚠️ Telegram бот недоступен (подключение): {} (URL: {})", 
                e.getMessage(), telegramBotUrl);
            return false;
        } catch (RestClientException e) {
            logger.warn("⚠️ Telegram бот недоступен: {}", e.getMessage());
            return false;
        }
    }
}
