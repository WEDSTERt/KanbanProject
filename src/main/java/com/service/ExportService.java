package com.service;

import com.dto.*;
import com.entity.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.repository.ProjectRepository;
import com.repository.SubgroupRepository;
import com.repository.TagRepository;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class ExportService {

    private final ProjectRepository projectRepository;
    private final SubgroupRepository subgroupRepository;
    private final TaskService taskService;
    private final TagRepository tagRepository;
    private final ObjectMapper objectMapper;

    public ExportService(ProjectRepository projectRepository,
                         SubgroupRepository subgroupRepository,
                         TaskService taskService,
                         TagRepository tagRepository,
                         ObjectMapper objectMapper) {
        this.projectRepository = projectRepository;
        this.subgroupRepository = subgroupRepository;
        this.taskService = taskService;
        this.tagRepository = tagRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public byte[] exportProjectToZip(Long projectId, User currentUser) {
        // Загружаем проект с подгруппами (без сразу загрузки задач)
        Project project = projectRepository.findByIdWithDetails(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        // Проверка прав (members загружается лениво, но внутри транзакции это безопасно)
        boolean isMember = project.getMembers().stream().anyMatch(m -> m.getUserId().equals(currentUser.getId()));
        if (!isMember) {
            throw new SecurityException("Access denied: not a member of this project");
        }

        // Загружаем задачи для каждой подгруппы отдельно (избегаем MultipleBagFetchException)
        for (Subgroup sg : project.getSubgroups()) {
            Subgroup fullSubgroup = subgroupRepository.findByIdWithTasks(sg.getId())
                    .orElseThrow(() -> new RuntimeException("Subgroup not found"));
            sg.setTasks(fullSubgroup.getTasks());
            
            // Инициализируем все необходимые ленивые коллекции (теги, исполнители, вложения)
            for (Task task : sg.getTasks()) {
                Hibernate.initialize(task.getTags());
                Hibernate.initialize(task.getAssignees());
                Hibernate.initialize(task.getAttachments());
            }
        }

        ProjectExportDto dto = buildProjectExportDto(project);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(dto);
            ZipEntry jsonEntry = new ZipEntry("project.json");
            zos.putNextEntry(jsonEntry);
            zos.write(json.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();

            addAttachmentsToZip(project, zos);
        } catch (IOException e) {
            throw new RuntimeException("Failed to create ZIP archive", e);
        }
        return baos.toByteArray();
    }

    @Transactional(readOnly = true)
    public byte[] exportSubgroupToZip(Long subgroupId, User currentUser) {
        // Загружаем подгруппу с задачами
        Subgroup subgroup = subgroupRepository.findByIdWithTasks(subgroupId)
                .orElseThrow(() -> new RuntimeException("Subgroup not found"));
        Project project = subgroup.getProject();

        // Проверка прав
        boolean isMember = project.getMembers().stream().anyMatch(m -> m.getUserId().equals(currentUser.getId()));
        if (!isMember) {
            throw new SecurityException("Access denied: not a member of the project");
        }

        // Инициализируем коллекции для задач подгруппы
        for (Task task : subgroup.getTasks()) {
            Hibernate.initialize(task.getTags());
            Hibernate.initialize(task.getAssignees());
            Hibernate.initialize(task.getAttachments());
        }

        SubgroupExportDto dto = buildSubgroupExportDto(subgroup);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(dto);
            ZipEntry jsonEntry = new ZipEntry("subgroup.json");
            zos.putNextEntry(jsonEntry);
            zos.write(json.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();

            addAttachmentsForSubgroup(subgroup, zos);
        } catch (IOException e) {
            throw new RuntimeException("Failed to create ZIP archive", e);
        }
        return baos.toByteArray();
    }

    // ------------------ Построение DTO ------------------

    private ProjectExportDto buildProjectExportDto(Project project) {
        ProjectExportDto dto = new ProjectExportDto();
        dto.setId(project.getId());
        dto.setName(project.getName());
        dto.setOwnerUserId(project.getOwner().getId());
        dto.setOwnerFullName(project.getOwner().getFullName());

        List<TagExportDto> tags = new ArrayList<>();
        for (Tag tag : tagRepository.findByProjectId(project.getId())) {
            tags.add(new TagExportDto(tag.getId(), tag.getName(), tag.getColor()));
        }
        dto.setTags(tags);

        List<SubgroupExportDto> subgroups = new ArrayList<>();
        for (Subgroup sg : project.getSubgroups()) {
            subgroups.add(buildSubgroupExportDto(sg));
        }
        dto.setSubgroups(subgroups);
        return dto;
    }

    private SubgroupExportDto buildSubgroupExportDto(Subgroup subgroup) {
        SubgroupExportDto dto = new SubgroupExportDto();
        dto.setId(subgroup.getId());
        dto.setName(subgroup.getName());

        List<Task> allTasks = subgroup.getTasks();
        Map<Long, List<Task>> childrenMap = new HashMap<>();
        for (Task t : allTasks) {
            Long parentId = t.getParentTaskId() != null ? t.getParentTaskId() : 0L;
            childrenMap.computeIfAbsent(parentId, k -> new ArrayList<>()).add(t);
        }
        List<TaskExportDto> rootTasks = new ArrayList<>();
        for (Task task : childrenMap.getOrDefault(0L, Collections.emptyList())) {
            rootTasks.add(buildTaskExportDto(task, childrenMap));
        }
        dto.setTasks(rootTasks);
        return dto;
    }

    private TaskExportDto buildTaskExportDto(Task task, Map<Long, List<Task>> childrenMap) {
        TaskExportDto dto = new TaskExportDto();
        dto.setId(task.getId());
        dto.setTitle(task.getTitle());
        dto.setDescription(task.getDescription());
        dto.setDueDate(task.getDueDate());
        dto.setValue(task.getValue());
        dto.setStatus(task.getStatus());
        dto.setCreatedByUserId(task.getCreatedByUserId());
        dto.setCreatedByFullName(task.getCreatedBy() != null ? task.getCreatedBy().getFullName() : null);

        List<TagExportDto> tags = new ArrayList<>();
        for (Tag tag : task.getTags()) {
            tags.add(new TagExportDto(tag.getId(), tag.getName(), tag.getColor()));
        }
        dto.setTags(tags);

        List<AttachmentRefDto> attachments = new ArrayList<>();
        for (Attachment att : task.getAttachments()) {
            String path = "attachments/task_" + task.getId() + "/" + att.getFileName();
            attachments.add(new AttachmentRefDto(att.getFileName(), path));
        }
        dto.setAttachments(attachments);

        List<TaskExportDto> subTasks = new ArrayList<>();
        for (Task child : childrenMap.getOrDefault(task.getId(), Collections.emptyList())) {
            subTasks.add(buildTaskExportDto(child, childrenMap));
        }
        dto.setSubTasks(subTasks);
        return dto;
    }

    // ------------------ Добавление файлов в ZIP ------------------

    private void addAttachmentsToZip(Project project, ZipOutputStream zos) throws IOException {
        for (Subgroup sg : project.getSubgroups()) {
            addAttachmentsForSubgroup(sg, zos);
        }
    }

    private void addAttachmentsForSubgroup(Subgroup subgroup, ZipOutputStream zos) throws IOException {
        for (Task task : subgroup.getTasks()) {
            for (Attachment att : task.getAttachments()) {
                String entryPath = "attachments/task_" + task.getId() + "/" + att.getFileName();
                ZipEntry entry = new ZipEntry(entryPath);
                zos.putNextEntry(entry);
                zos.write(att.getFileData());
                zos.closeEntry();
            }
        }
    }
}
