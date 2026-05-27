package com.dto;

public class AttachmentRefDto {
    private String fileName;
    private String filePath; // путь внутри ZIP: attachments/task_{taskId}/{fileName}

    public AttachmentRefDto(String fileName, String filePath) {
        this.fileName = fileName;
        this.filePath = filePath;
    }

    // геттеры
    public String getFileName() { return fileName; }
    public String getFilePath() { return filePath; }
}