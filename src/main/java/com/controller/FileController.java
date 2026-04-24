package com.controller;

import com.entity.Attachment;
import com.service.TaskService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final TaskService taskService;

    public FileController(TaskService taskService) {
        this.taskService = taskService;
    }

    @PostMapping("/upload/{taskId}")
    public Attachment upload(@PathVariable Long taskId, @RequestParam MultipartFile file) {
        return taskService.addAttachment(taskId, file);
    }

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> download(@PathVariable Long id) {
        Attachment attachment = taskService.getAttachmentById(id);
        byte[] content = taskService.getAttachmentContent(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + attachment.getFileName() + "\"")
                .contentType(MediaType.parseMediaType(attachment.getFileType()))
                .body(content);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        taskService.deleteAttachment(id);
    }
}