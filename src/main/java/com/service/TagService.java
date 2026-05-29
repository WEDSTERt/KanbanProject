package com.service;

import com.entity.*;
import com.repository.*;
import org.hibernate.Hibernate;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class TagService {

    private final TagRepository tagRepository;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;

    public TagService(TagRepository tagRepository,
                      ProjectRepository projectRepository,
                      TaskRepository taskRepository) {
        this.tagRepository = tagRepository;
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
    }

    @Transactional
    public List<Tag> getTagsByProject(Long projectId) {
        return tagRepository.findByProjectId(projectId);
    }

    // ✅ ИСПРАВЛЕНО: Добавлен @CacheEvict
    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public Tag createTag(Long projectId, String name, String color) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        if (tagRepository.findByProjectIdAndName(projectId, name).isPresent()) {
            throw new RuntimeException("Tag with this name already exists");
        }

        Tag tag = new Tag(name, color, project);
        return tagRepository.save(tag);
    }

    // ✅ ИСПРАВЛЕНО: Добавлен @CacheEvict
    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public Tag updateTag(Long id, String name, String color) {
        Tag tag = tagRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Tag not found"));
        if (name != null && !name.trim().isEmpty()) {
            tag.setName(name);
        }
        if (color != null) {
            tag.setColor(color);
        }
        return tagRepository.save(tag);
    }

    // ✅ ИСПРАВЛЕНО: Добавлен @CacheEvict
    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public void deleteTag(Long id) {
        Tag tag = tagRepository.findById(id).orElse(null);
        if (tag != null) {
            System.out.println("🗑️ Deleting tag: " + tag.getName() + " (id=" + id + ")");
            // Удаляем связи с задачами
            tagRepository.deleteTagRelations(id);
            System.out.println("✅ Tag relations deleted");
            // Удаляем сам тег
            tagRepository.deleteById(id);
            System.out.println("✅ Tag deleted from database");
        }
    }

    // ✅ ИСПРАВЛЕНО: Добавлен @CacheEvict
    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public Task addTagToTask(Long taskId, Long tagId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        Tag tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new RuntimeException("Tag not found"));

        // ✅ Инициализируем теги для Hibernate
        Hibernate.initialize(task.getTags());

        List<Tag> tags = task.getTags();
        if (tags == null) {
            tags = new ArrayList<>();
            task.setTags(tags);
            System.out.println("⚠️  Tags list was null, initialized new ArrayList");
        }
        
        if (!tags.stream().anyMatch(t -> t.getId().equals(tag.getId()))) {
            tags.add(tag);
            System.out.println("✅ Tag added: " + tag.getName() + " to task " + taskId);
            System.out.println("Total tags now: " + tags.size());
        } else {
            System.out.println("ℹ️  Tag " + tag.getName() + " already on task " + taskId);
        }
        Task savedTask = taskRepository.saveAndFlush(task);
        System.out.println("Task saved. Tags count: " + savedTask.getTags().size());
        for (Tag t : savedTask.getTags()) {
            System.out.println("  - Tag: " + t.getName());
        }
        return savedTask;
    }

    // ✅ ИСПРАВЛЕНО: Добавлен @CacheEvict
    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public Task removeTagFromTask(Long taskId, Long tagId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        Tag tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new RuntimeException("Tag not found"));

        System.out.println("🔍 Before removal: tags count = " + task.getTags().size());
        for (Tag t : task.getTags()) {
            System.out.println("  - Tag: id=" + t.getId() + ", name=" + t.getName());
        }
        System.out.println("🔍 Tag to remove: " + tag.getId() + " - " + tag.getName());

        List<Tag> tags = task.getTags();
        if (tags == null) {
            tags = new ArrayList<>();
            task.setTags(tags);
            System.out.println("⚠️  Tags list was null!");
        }
        
        boolean removed = tags.removeIf(t -> t.getId().equals(tagId));
        System.out.println("🔍 After removal: removed = " + removed + ", tags count = " + tags.size());

        if (removed) {
            for (Tag t : tags) {
                System.out.println("  - Remaining tag: id=" + t.getId() + ", name=" + t.getName());
            }
        } else {
            System.out.println("⚠️  Tag not found in task's tag list!");
        }

        Task savedTask = taskRepository.saveAndFlush(task);
        System.out.println("✅ Task saved and flushed. Final tags count: " + savedTask.getTags().size());

        return savedTask;
    }

    // ✅ ИСПРАВЛЕНО: Добавлен @CacheEvict
    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public Task addMultipleTagsToTask(Long taskId, List<Long> tagIds) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        Hibernate.initialize(task.getTags());

        List<Tag> tags = task.getTags();
        if (tags == null) {
            tags = new ArrayList<>();
            task.setTags(tags);
        }
        
        for (Long tagId : tagIds) {
            Tag tag = tagRepository.findById(tagId)
                    .orElseThrow(() -> new RuntimeException("Tag with id " + tagId + " not found"));
            if (!tags.stream().anyMatch(t -> t.getId().equals(tag.getId()))) {
                tags.add(tag);
            }
        }
        return taskRepository.saveAndFlush(task);
    }

    // ✅ ИСПРАВЛЕНО: Добавлен @CacheEvict
    @CacheEvict(value = {"tasksBySubgroup", "tasksByAssignee"}, allEntries = true)
    @Transactional
    public Task setTaskTags(Long taskId, List<Long> tagIds) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        Hibernate.initialize(task.getTags());

        List<Tag> tags = task.getTags();
        if (tags == null) {
            tags = new ArrayList<>();
            task.setTags(tags);
        }
        
        tags.clear();

        for (Long tagId : tagIds) {
            Tag tag = tagRepository.findById(tagId)
                    .orElseThrow(() -> new RuntimeException("Tag with id " + tagId + " not found"));
            tags.add(tag);
        }
        return taskRepository.saveAndFlush(task);
    }
}
