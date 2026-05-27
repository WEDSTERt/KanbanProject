package com.dto;

import java.util.List;

public class SubgroupExportDto {
    private Long id;
    private String name;
    private List<TaskExportDto> tasks;

    // геттеры/сеттеры
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public List<TaskExportDto> getTasks() { return tasks; }
    public void setTasks(List<TaskExportDto> tasks) { this.tasks = tasks; }
}