package com.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subgroup_id", nullable = false)
    @JsonIgnore
    private Subgroup subgroup;

    @Column(name = "subgroup_id", insertable = false, updatable = false)
    private Long subgroupId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    @JsonIgnore
    private User createdBy;

    @Column(name = "created_by_user_id", insertable = false, updatable = false)
    private Long createdByUserId;

    @Column(name = "due_date")
    private OffsetDateTime dueDate;

    @Column(name = "value")
    private Integer value;

    @Column(name = "status")
    private Integer status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private OffsetDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_task_id")
    @JsonIgnore
    private Task parentTask;

    @Column(name = "parent_task_id", insertable = false, updatable = false)
    private Long parentTaskId;

    @Column(name = "overdue_notified", nullable = false)
    private Boolean overdueNotified = false;

    @OneToMany(mappedBy = "parentTask", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Task> subTasks = new ArrayList<>();

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Attachment> attachments = new ArrayList<>();

    @ManyToMany
    @JoinTable(
            name = "task_assignees",
            joinColumns = @JoinColumn(name = "task_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    @JsonIgnore
    private List<User> assignees = new ArrayList<>();

    @ManyToMany(fetch = FetchType.LAZY, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
            name = "task_tags",
            joinColumns = @JoinColumn(name = "task_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private List<Tag> tags = new ArrayList<>();

    @Transient
    private Integer subTasksCount;

    public Task() {}

    public Task(String title, String description, Subgroup subgroup, User createdBy) {
        this.title = title;
        this.description = description;
        this.subgroup = subgroup;
        this.subgroupId = subgroup.getId();
        this.createdBy = createdBy;
        this.createdByUserId = createdBy.getId();
        this.parentTaskId = 0L;
        this.overdueNotified = false;
    }

    // Геттеры и сеттеры
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Subgroup getSubgroup() { return subgroup; }
    public void setSubgroup(Subgroup subgroup) {
        this.subgroup = subgroup;
        if (subgroup != null) {
            this.subgroupId = subgroup.getId();
        }
    }

    public Long getSubgroupId() { return subgroupId; }
    public void setSubgroupId(Long subgroupId) { this.subgroupId = subgroupId; }

    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) {
        this.createdBy = createdBy;
        if (createdBy != null) {
            this.createdByUserId = createdBy.getId();
        }
    }

    public Long getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(Long createdByUserId) { this.createdByUserId = createdByUserId; }

    public OffsetDateTime getDueDate() { return dueDate; }
    public void setDueDate(OffsetDateTime dueDate) { this.dueDate = dueDate; }

    public Integer getValue() { return value; }
    public void setValue(Integer value) { this.value = value; }

    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public Task getParentTask() { return parentTask; }
    public void setParentTask(Task parentTask) {
        this.parentTask = parentTask;
        if (parentTask != null) {
            this.parentTaskId = parentTask.getId();
        } else {
            this.parentTaskId = 0L;
        }
    }

    public Long getParentTaskId() { return parentTaskId; }
    public void setParentTaskId(Long parentTaskId) {
        this.parentTaskId = parentTaskId != null ? parentTaskId : 0L;
    }

    public Boolean getOverdueNotified() { return overdueNotified; }
    public void setOverdueNotified(Boolean overdueNotified) {
        this.overdueNotified = overdueNotified != null ? overdueNotified : false;
    }

    public List<Task> getSubTasks() { return subTasks; }
    public void setSubTasks(List<Task> subTasks) { this.subTasks = subTasks; }

    public List<User> getAssignees() { return assignees; }
    public void setAssignees(List<User> assignees) { this.assignees = assignees; }

    public List<Attachment> getAttachments() { return attachments; }
    public void setAttachments(List<Attachment> attachments) { this.attachments = attachments; }

    public List<Tag> getTags() { return tags; }
    public void setTags(List<Tag> tags) { this.tags = tags; }

    public Integer getSubTasksCount() { return subTasksCount; }
    public void setSubTasksCount(Integer subTasksCount) { this.subTasksCount = subTasksCount; }
}
