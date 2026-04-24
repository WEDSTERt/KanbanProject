package com.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "subgroup_members")
public class SubgroupMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subgroup_id", nullable = false)
    private Subgroup subgroup;

    @Column(name = "subgroup_id", insertable = false, updatable = false)
    private Long subgroupId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role_sub")
    private RoleSubgroup role;

    public SubgroupMember() {}

    public SubgroupMember(Subgroup subgroup, User user, RoleSubgroup role) {
        this.subgroup = subgroup;
        this.user = user;
        this.subgroupId = subgroup.getId();
        this.userId = user.getId();
        this.role = role;
    }

    // Геттеры и сеттеры
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Subgroup getSubgroup() { return subgroup; }
    public void setSubgroup(Subgroup subgroup) { this.subgroup = subgroup; }
    public Long getSubgroupId() { return subgroupId; }
    public void setSubgroupId(Long subgroupId) { this.subgroupId = subgroupId; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public RoleSubgroup getRole() { return role; }
    public void setRole(RoleSubgroup role) { this.role = role; }
}