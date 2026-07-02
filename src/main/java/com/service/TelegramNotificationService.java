package com.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.*;
import java.util.logging.Logger;

/**
 * 📱 Сервис отправки уведомлений в Telegram бот
 * 
 * Интегрирует Java backend с Python Telegram ботом через REST API webhook
 */
@Service
public class TelegramNotificationService {
    
    private static final Logger logger = Logger.getLogger(TelegramNotificationService.class.getName());
    
    @Autowired
    private RestTemplate restTemplate;
    
    @Value("${telegram.webhook.url:http://localhost:8001}")
    private String webhookUrl;
    
    @Value("${telegram.webhook.secret:c8e2f9a1d4b7e3f6a9c2d5e8f1b4c7a0d3e6f9b2c5a8d1e4f7b0c3e6f9a2d5b8}")
    private String webhookSecret;
    
    // ============ УВЕДОМЛЕНИЯ О ЗАДАЧАХ ============
    
    /**
     * 📬 Отправить уведомление о создании задачи
     */
    public void notifyTaskCreated(Long projectId, String projectName,
                                  Long groupId, String groupName,
                                  Long taskId, String title,
                                  String priority, List<Long> userIds) {
        
        logger.info("📬 Отправка уведомления о создании задачи: " + title);
        
        Map<String, Object> body = new HashMap<>();
        body.put("event_type", "created");
        body.put("project_id", projectId);
        body.put("project_name", projectName);
        body.put("group_id", groupId);
        body.put("group_name", groupName);
        body.put("task_id", taskId);
        body.put("title", title);
        body.put("priority", priority);
        body.put("user_ids", userIds);
        
        sendToTelegram("/api/telegram/notify/task", body);
    }
    
    /**
     * 📬 Отправить уведомление об изменении статуса задачи
     */
    public void notifyTaskStatusChanged(Long projectId, String projectName,
                                       Long groupId, String groupName,
                                       Long taskId, String title,
                                       String oldStatus, String newStatus,
                                       List<Long> userIds) {
        
        logger.info("📬 Отправка уведомления об изменении статуса: " + oldStatus + " → " + newStatus);
        
        Map<String, Object> body = new HashMap<>();
        body.put("event_type", "status_changed");
        body.put("project_id", projectId);
        body.put("project_name", projectName);
        body.put("group_id", groupId);
        body.put("group_name", groupName);
        body.put("task_id", taskId);
        body.put("title", title);
        body.put("old_status", oldStatus);
        body.put("new_status", newStatus);
        body.put("user_ids", userIds);
        
        sendToTelegram("/api/telegram/notify/task", body);
    }
    
    /**
     * 📬 Отправить уведомление об удалении задачи
     */
    public void notifyTaskDeleted(Long projectId, String projectName,
                                 Long groupId, String groupName,
                                 Long taskId, String title,
                                 List<Long> userIds) {
        
        logger.info("📬 Отправка уведомления об удалении задачи: " + title);
        
        Map<String, Object> body = new HashMap<>();
        body.put("event_type", "deleted");
        body.put("project_id", projectId);
        body.put("project_name", projectName);
        body.put("group_id", groupId);
        body.put("group_name", groupName);
        body.put("task_id", taskId);
        body.put("title", title);
        body.put("user_ids", userIds);
        
        sendToTelegram("/api/telegram/notify/task", body);
    }
    
    /**
     * 📬 Отправить уведомление об обновлении задачи
     */
    public void notifyTaskUpdated(Long projectId, String projectName,
                                 Long groupId, String groupName,
                                 Long taskId, String title,
                                 String changes, List<Long> userIds) {
        
        logger.info("📬 Отправка уведомления об обновлении задачи: " + title);
        
        Map<String, Object> body = new HashMap<>();
        body.put("event_type", "updated");
        body.put("project_id", projectId);
        body.put("project_name", projectName);
        body.put("group_id", groupId);
        body.put("group_name", groupName);
        body.put("task_id", taskId);
        body.put("title", title);
        body.put("changes", changes);
        body.put("user_ids", userIds);
        
        sendToTelegram("/api/telegram/notify/task", body);
    }
    
    /**
     * ⚠️ Отправить уведомление о просрочке задачи
     */
    public void notifyTaskOverdue(Long projectId, String projectName,
                                 Long groupId, String groupName,
                                 Long taskId, String title,
                                 String dueDate, Integer daysOverdue,
                                 List<Long> userIds) {
        
        logger.info("⚠️ Отправка уведомления о просрочке задачи: " + title);
        
        Map<String, Object> body = new HashMap<>();
        body.put("event_type", "overdue");
        body.put("project_id", projectId);
        body.put("project_name", projectName);
        body.put("group_id", groupId);
        body.put("group_name", groupName);
        body.put("task_id", taskId);
        body.put("title", title);
        body.put("due_date", dueDate);
        body.put("days_overdue", daysOverdue);
        body.put("user_ids", userIds);
        
        sendToTelegram("/api/telegram/notify/task", body);
    }
    
    // ============ УВЕДОМЛЕНИЯ О ГРУППАХ ============
    
    /**
     * 📬 Отправить уведомление о создании группы
     */
    public void notifyGroupCreated(Long projectId, String projectName,
                                  Long groupId, String groupName,
                                  String description, List<Long> userIds) {
        
        logger.info("📬 Отправка уведомления о создании группы: " + groupName);
        
        Map<String, Object> body = new HashMap<>();
        body.put("event_type", "created");
        body.put("project_id", projectId);
        body.put("project_name", projectName);
        body.put("group_id", groupId);
        body.put("group_name", groupName);
        body.put("description", description);
        body.put("user_ids", userIds);
        
        sendToTelegram("/api/telegram/notify/group", body);
    }
    
    /**
     * 📬 Отправить уведомление об удалении группы
     */
    public void notifyGroupDeleted(Long projectId, String projectName,
                                  Long groupId, String groupName,
                                  List<Long> userIds) {
        
        logger.info("📬 Отправка уведомления об удалении группы: " + groupName);
        
        Map<String, Object> body = new HashMap<>();
        body.put("event_type", "deleted");
        body.put("project_id", projectId);
        body.put("project_name", projectName);
        body.put("group_id", groupId);
        body.put("group_name", groupName);
        body.put("user_ids", userIds);
        
        sendToTelegram("/api/telegram/notify/group", body);
    }
    
    // ============ УВЕДОМЛЕНИЯ О ПРОЕКТАХ ============
    
    /**
     * 📬 Отправить уведомление о создании проекта
     */
    public void notifyProjectCreated(Long projectId, String projectName,
                                    String description, List<Long> userIds) {
        
        logger.info("📬 Отправка уведомления о создании проекта: " + projectName);
        
        Map<String, Object> body = new HashMap<>();
        body.put("event_type", "created");
        body.put("project_id", projectId);
        body.put("project_name", projectName);
        body.put("description", description);
        body.put("user_ids", userIds);
        
        sendToTelegram("/api/telegram/notify/project", body);
    }
    
    /**
     * 📬 Отправить уведомление об удалении проекта
     */
    public void notifyProjectDeleted(Long projectId, String projectName,
                                    List<Long> userIds) {
        
        logger.info("📬 Отправка уведомления об удалении проекта: " + projectName);
        
        Map<String, Object> body = new HashMap<>();
        body.put("event_type", "deleted");
        body.put("project_id", projectId);
        body.put("project_name", projectName);
        body.put("user_ids", userIds);
        
        sendToTelegram("/api/telegram/notify/project", body);
    }
    
    // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============
    
    /**
     * 📤 Отправить запрос на webhook
     */
    private void sendToTelegram(String endpoint, Map<String, Object> body) {
        new Thread(() -> {
            try {
                String url = webhookUrl + endpoint;
                
                // Сериализуем тело в JSON
                String jsonBody = new ObjectMapper().writeValueAsString(body);
                
                // Вычисляем HMAC подпись
                String signature = calculateHmac(jsonBody);
                
                // Готовим заголовки
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("X-Signature", signature);
                
                // Создаем HTTP запрос
                HttpEntity<String> request = new HttpEntity<>(jsonBody, headers);
                
                // Отправляем
                restTemplate.postForObject(url, request, String.class);
                
                logger.info("✅ Уведомление успешно отправлено в Telegram бот");
                
            } catch (Exception e) {
                logger.severe("❌ Ошибка отправки уведомления в Telegram: " + e.getMessage());
                e.printStackTrace();
            }
        }).start();
    }
    
    /**
     * 🔐 Вычислить HMAC SHA256 подпись
     */
    private String calculateHmac(String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec keySpec = new SecretKeySpec(
            webhookSecret.getBytes(),
            0,
            webhookSecret.getBytes().length,
            "HmacSHA256"
        );
        mac.init(keySpec);
        byte[] rawHmac = mac.doFinal(data.getBytes());
        
        // Преобразуем в hex строку
        StringBuilder sb = new StringBuilder();
        for (byte b : rawHmac) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
    
    /**
     * ✅ Проверить доступность webhook'а
     */
    public boolean isWebhookAvailable() {
        try {
            String response = restTemplate.getForObject(webhookUrl + "/api/telegram/health", String.class);
            logger.info("✅ Webhook доступен");
            return true;
        } catch (Exception e) {
            logger.warning("⚠️ Webhook недоступен: " + e.getMessage());
            return false;
        }
    }
}
