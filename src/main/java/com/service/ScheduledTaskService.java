package com.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class ScheduledTaskService {

    private final TaskService taskService;

    public ScheduledTaskService(TaskService taskService) {
        this.taskService = taskService;
    }

    // Запускается каждые 30 секунд
    @Scheduled(cron = "*/30 * * * * *")
    public void checkOverdueTasks() {
        System.out.println("⏰ Running scheduled overdue tasks check at " + java.time.LocalDateTime.now());
        taskService.checkOverdueTasksAndNotify();
    }
}