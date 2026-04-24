package com.entity;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;


@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "email", unique = true, nullable = false)
    private String email;

    @Column(name = "user_password", nullable = false)
    private String userPassword;

    @OneToMany(mappedBy = "owner", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Project> ownedProjects = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProjectMember> projectMemberships = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SubgroupMember> subgroupMemberships = new ArrayList<>();

    @OneToMany(mappedBy = "createdBy")
    private List<Task> createdTasks = new ArrayList<>();

    @ManyToMany(mappedBy = "assignees")
    private List<Task> assignedTasks = new ArrayList<>();

    public User() {}

    public User(String fullName, String email, String userPassword) {
        this.fullName = fullName;
        this.email = email;
        this.userPassword = userPassword;
    }

    // Геттеры и сеттеры
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getUserPassword() { return userPassword; }
    public void setUserPassword(String userPassword) { this.userPassword = userPassword; }

    public List<Project> getOwnedProjects() { return ownedProjects; }
    public void setOwnedProjects(List<Project> ownedProjects) { this.ownedProjects = ownedProjects; }
    public List<ProjectMember> getProjectMemberships() { return projectMemberships; }
    public void setProjectMemberships(List<ProjectMember> projectMemberships) { this.projectMemberships = projectMemberships; }
    public List<SubgroupMember> getSubgroupMemberships() { return subgroupMemberships; }
    public void setSubgroupMemberships(List<SubgroupMember> subgroupMemberships) { this.subgroupMemberships = subgroupMemberships; }
    public List<Task> getCreatedTasks() { return createdTasks; }
    public void setCreatedTasks(List<Task> createdTasks) { this.createdTasks = createdTasks; }
    public List<Task> getAssignedTasks() { return assignedTasks; }
    public void setAssignedTasks(List<Task> assignedTasks) { this.assignedTasks = assignedTasks; }
}