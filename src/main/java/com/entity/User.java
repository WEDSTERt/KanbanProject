package com.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;
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
    @JsonIgnore
    private String userPassword;

    @Column(name = "email_verified", nullable = false)
    private Boolean emailVerified = false;

    @Column(name = "verification_token")
    private String verificationToken;

    @Column(name = "verification_token_expiry")
    private LocalDateTime verificationTokenExpiry;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "email_notifications_enabled", nullable = false)
    private Boolean emailNotificationsEnabled = true;

    @OneToMany(mappedBy = "owner", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Project> ownedProjects = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<ProjectMember> projectMemberships = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<SubgroupMember> subgroupMemberships = new ArrayList<>();

    @OneToMany(mappedBy = "createdBy")
    @JsonIgnore
    private List<Task> createdTasks = new ArrayList<>();

    @ManyToMany(mappedBy = "assignees")
    @JsonIgnore
    private List<Task> assignedTasks = new ArrayList<>();

    public User() {}

    public User(String fullName, String email, String userPassword) {
        this.fullName = fullName;
        this.email = email;
        this.userPassword = userPassword;
        this.emailVerified = false;
        this.emailNotificationsEnabled = true;
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

    public Boolean getEmailVerified() { return emailVerified; }
    public void setEmailVerified(Boolean emailVerified) { this.emailVerified = emailVerified; }

    public String getVerificationToken() { return verificationToken; }
    public void setVerificationToken(String verificationToken) { this.verificationToken = verificationToken; }

    public LocalDateTime getVerificationTokenExpiry() { return verificationTokenExpiry; }
    public void setVerificationTokenExpiry(LocalDateTime verificationTokenExpiry) { this.verificationTokenExpiry = verificationTokenExpiry; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Boolean getEmailNotificationsEnabled() { return emailNotificationsEnabled; }
    public void setEmailNotificationsEnabled(Boolean emailNotificationsEnabled) {
        this.emailNotificationsEnabled = emailNotificationsEnabled != null ? emailNotificationsEnabled : true;
    }

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
