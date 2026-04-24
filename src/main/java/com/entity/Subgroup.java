package com.entity;


import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "subgroups")
public class Subgroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "project_id", insertable = false, updatable = false)
    private Long projectId;

    @OneToMany(mappedBy = "subgroup", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SubgroupMember> members = new ArrayList<>();

    @OneToMany(mappedBy = "subgroup", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Task> tasks = new ArrayList<>();

    public Subgroup() {}

    public Subgroup(String name, Project project) {
        this.name = name;
        this.project = project;
        this.projectId = project.getId();
    }

    // Геттеры и сеттеры
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }
    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }
    public List<SubgroupMember> getMembers() { return members; }
    public void setMembers(List<SubgroupMember> members) { this.members = members; }
    public List<Task> getTasks() { return tasks; }
    public void setTasks(List<Task> tasks) { this.tasks = tasks; }
}