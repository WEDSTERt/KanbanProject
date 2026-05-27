package com.dto;

import java.time.OffsetDateTime;
import java.util.List;

public class TaskExportDto {
    private Long id;
    private String title;
    private String description;
    private OffsetDateTime dueDate;
    private Integer value;
    private Integer status; // 0,1,2
    private Long createdByUserId;
    private String createdByFullName;
    private List<TagExportDto> tags;
    private List<AttachmentRefDto> attachments;
    private List<TaskExportDto> subTasks;

    public TaskExportDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public OffsetDateTime getDueDate() { return dueDate; }
    public void setDueDate(OffsetDateTime dueDate) { this.dueDate = dueDate; }
    public Integer getValue() { return value; }
    public void setValue(Integer value) { this.value = value; }
    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }
    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }
    public String getCreatedByFullName() { return createdByFullName; }
    public void setCreatedByFullName(String createdByFullName) { this.createdByFullName = createdByFullName; }
    public List<TagExportDto> getTags() { return tags; }
    public void setTags(List<TagExportDto> tags) { this.tags = tags; }
    public List<AttachmentRefDto> getAttachments() { return attachments; }
    public void setAttachments(List<AttachmentRefDto> attachments) { this.attachments = attachments; }
    public List<TaskExportDto> getSubTasks() { return subTasks; }
    public void setSubTasks(List<TaskExportDto> subTasks) { this.subTasks = subTasks; }
}