package com.dto;

import java.time.LocalDateTime;

public class NotificationDTO {
    private Long id;
    private String type;
    private String title;
    private String message;
    private Long taskId;
    private Long projectId;
    private Boolean isRead;
    private LocalDateTime createdAt;
    private LocalDateTime readAt;

    // Constructor
    public NotificationDTO() {}

    public NotificationDTO(Long id, String type, String title, String message, 
                          Long taskId, Long projectId, Boolean isRead, 
                          LocalDateTime createdAt, LocalDateTime readAt) {
        this.id = id;
        this.type = type;
        this.title = title;
        this.message = message;
        this.taskId = taskId;
        this.projectId = projectId;
        this.isRead = isRead;
        this.createdAt = createdAt;
        this.readAt = readAt;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Long getTaskId() {
        return taskId;
    }

    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public Boolean getIsRead() {
        return isRead;
    }

    public void setIsRead(Boolean isRead) {
        this.isRead = isRead;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getReadAt() {
        return readAt;
    }

    public void setReadAt(LocalDateTime readAt) {
        this.readAt = readAt;
    }
}
