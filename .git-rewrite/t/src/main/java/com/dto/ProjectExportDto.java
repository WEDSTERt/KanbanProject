package com.dto;

import java.util.List;

public class ProjectExportDto {
    private Long id;
    private String name;
    private Long ownerUserId;
    private String ownerFullName;
    private List<TagExportDto> tags;
    private List<SubgroupExportDto> subgroups;

    // геттеры/сеттеры
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Long getOwnerUserId() { return ownerUserId; }
    public void setOwnerUserId(Long ownerUserId) { this.ownerUserId = ownerUserId; }
    public String getOwnerFullName() { return ownerFullName; }
    public void setOwnerFullName(String ownerFullName) { this.ownerFullName = ownerFullName; }
    public List<TagExportDto> getTags() { return tags; }
    public void setTags(List<TagExportDto> tags) { this.tags = tags; }
    public List<SubgroupExportDto> getSubgroups() { return subgroups; }
    public void setSubgroups(List<SubgroupExportDto> subgroups) { this.subgroups = subgroups; }
}