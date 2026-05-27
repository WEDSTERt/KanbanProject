package com.repository;

import com.entity.Tag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface TagRepository extends JpaRepository<Tag, Long> {
    @Query("SELECT t FROM Tag t WHERE t.project.id = ?1")
    List<Tag> findByProjectId(Long projectId);
    
    @Query("SELECT t FROM Tag t WHERE t.project.id = ?1 AND LOWER(t.name) = LOWER(?2)")
    Optional<Tag> findByProjectIdAndName(Long projectId, String name);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM task_tags WHERE tag_id = ?1", nativeQuery = true)
    void deleteTagRelations(Long tagId);
    
    @Override
    @NonNull
    Optional<Tag> findById(@NonNull Long id);
}
