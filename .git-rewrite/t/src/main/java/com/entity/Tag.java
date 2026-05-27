package com.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "tags")
public class Tag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "color", nullable = false)
    private String color = "#3b82f6";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnore
    private Project project;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public Tag() {}

    public Tag(String name, String color, Project project) {
        this.name = name;
        this.color = color != null ? color : "#3b82f6";
        this.project = project;
    }

    // Геттеры и сеттеры
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public Project getProject() { return project; }
    public void setProject(Project project) {
        this.project = project;
    }

    public Long getProjectId() {
        return project != null ? project.getId() : null;
    }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
