package com.service;

import com.dto.*;
import com.entity.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.repository.TagRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
public class ImportService {

    private final ProjectService projectService;
    private final SubgroupService subgroupService;
    private final TaskService taskService;
    private final TagRepository tagRepository;
    private final ObjectMapper objectMapper;

    public ImportService(ProjectService projectService,
                         SubgroupService subgroupService,
                         TaskService taskService,
                         TagRepository tagRepository,
                         ObjectMapper objectMapper) {
        this.projectService = projectService;
        this.subgroupService = subgroupService;
        this.taskService = taskService;
        this.tagRepository = tagRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Project importProjectFromZip(MultipartFile file, User currentUser) throws IOException {
        Map<String, byte[]> files = extractZipFiles(file);
        byte[] jsonData = files.get("project.json");
        if (jsonData == null) {
            throw new RuntimeException("ZIP archive does not contain project.json");
        }
        ProjectExportDto dto = objectMapper.readValue(jsonData, ProjectExportDto.class);

        Project newProject = projectService.createProject(
                dto.getName() + " (imported)",
                currentUser.getId()
        );

        Map<Long, Long> tagIdMap = new HashMap<>();
        if (dto.getTags() != null) {
            for (TagExportDto tagDto : dto.getTags()) {
                Tag newTag = tagRepository.save(new Tag(tagDto.getName(), tagDto.getColor(), newProject));
                tagIdMap.put(tagDto.getId(), newTag.getId());
            }
        }

        if (dto.getSubgroups() != null) {
            for (SubgroupExportDto sgDto : dto.getSubgroups()) {
                Subgroup newSubgroup = subgroupService.createSubgroup(
                        newProject.getId(),
                        sgDto.getName(),
                        currentUser.getId()
                );
                restoreTasks(sgDto.getTasks(), newSubgroup, null, tagIdMap, files, currentUser);
            }
        }
        return newProject;
    }

    @Transactional
    public Subgroup importSubgroupIntoProject(MultipartFile file, Long projectId, User currentUser) throws IOException {
        Project project = projectService.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        Map<String, byte[]> files = extractZipFiles(file);
        byte[] jsonData = files.get("subgroup.json");
        if (jsonData == null) {
            throw new RuntimeException("ZIP archive does not contain subgroup.json");
        }
        SubgroupExportDto dto = objectMapper.readValue(jsonData, SubgroupExportDto.class);

        Subgroup newSubgroup = subgroupService.createSubgroup(
                projectId,
                dto.getName() + " (imported)",
                currentUser.getId()
        );

        List<Tag> existingTags = tagRepository.findByProjectId(projectId);
        Map<String, Tag> tagByName = new HashMap<>();
        for (Tag t : existingTags) {
            tagByName.put(t.getName(), t);
        }
        Map<Long, Long> tagIdMap = new HashMap<>();
        if (dto.getTasks() != null) {
            Set<TagExportDto> allTags = collectAllTags(dto.getTasks());
            for (TagExportDto tagDto : allTags) {
                Tag tag = tagByName.get(tagDto.getName());
                if (tag == null) {
                    tag = tagRepository.save(new Tag(tagDto.getName(), tagDto.getColor(), project));
                }
                tagIdMap.put(tagDto.getId(), tag.getId());
            }
        }

        restoreTasks(dto.getTasks(), newSubgroup, null, tagIdMap, files, currentUser);
        return newSubgroup;
    }

    private void restoreTasks(List<TaskExportDto> taskDtos,
                              Subgroup subgroup,
                              Task parentTask,
                              Map<Long, Long> tagIdMap,
                              Map<String, byte[]> files,
                              User currentUser) {
        if (taskDtos == null) return;
        for (TaskExportDto taskDto : taskDtos) {
            Task newTask = taskService.createTask(
                    subgroup.getId(),
                    currentUser.getId(),
                    taskDto.getTitle(),
                    taskDto.getDescription(),
                    taskDto.getDueDate(),
                    taskDto.getValue(),
                    taskDto.getStatus() == null ? TaskStatus.TODO :
                            (taskDto.getStatus() == 1 ? TaskStatus.IN_PROGRESS :
                                    (taskDto.getStatus() == 2 ? TaskStatus.REVIEW : TaskStatus.TODO)),
                    Collections.emptyList(),
                    parentTask != null ? parentTask.getId() : null
            );

            // Привязываем теги
            if (taskDto.getTags() != null && !taskDto.getTags().isEmpty()) {
                List<Long> newTagIds = new ArrayList<>();
                for (TagExportDto tagDto : taskDto.getTags()) {
                    Long newTagId = tagIdMap.get(tagDto.getId());
                    if (newTagId != null) {
                        newTagIds.add(newTagId);
                    }
                }
                if (!newTagIds.isEmpty()) {
                    taskService.setTaskTags(newTask.getId(), newTagIds);
                }
            }

            // Восстанавливаем вложения
            if (taskDto.getAttachments() != null) {
                for (AttachmentRefDto attRef : taskDto.getAttachments()) {
                    byte[] fileData = files.get(attRef.getFilePath());
                    if (fileData != null && fileData.length > 0) {
                        taskService.addAttachment(newTask.getId(), attRef.getFileName(), fileData, currentUser);
                    }
                }
            }

            restoreTasks(taskDto.getSubTasks(), subgroup, newTask, tagIdMap, files, currentUser);
        }
    }

    private Map<String, byte[]> extractZipFiles(MultipartFile file) throws IOException {
        Map<String, byte[]> files = new HashMap<>();
        try (ZipInputStream zis = new ZipInputStream(file.getInputStream())) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (!entry.isDirectory()) {
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    byte[] buffer = new byte[8192];
                    int len;
                    while ((len = zis.read(buffer)) > 0) {
                        baos.write(buffer, 0, len);
                    }
                    files.put(entry.getName(), baos.toByteArray());
                }
                zis.closeEntry();
            }
        }
        return files;
    }

    private Set<TagExportDto> collectAllTags(List<TaskExportDto> tasks) {
        Set<TagExportDto> allTags = new HashSet<>();
        if (tasks == null) return allTags;
        for (TaskExportDto task : tasks) {
            if (task.getTags() != null) {
                allTags.addAll(task.getTags());
            }
            allTags.addAll(collectAllTags(task.getSubTasks()));
        }
        return allTags;
    }
}