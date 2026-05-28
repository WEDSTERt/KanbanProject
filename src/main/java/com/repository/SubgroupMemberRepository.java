package com.repository;

import com.entity.SubgroupMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SubgroupMemberRepository extends JpaRepository<SubgroupMember, Long> {
    boolean existsBySubgroupIdAndUserId(Long subgroupId, Long userId);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM SubgroupMember sm WHERE sm.userId = :userId AND sm.subgroupId IN " +
            "(SELECT s.id FROM Subgroup s WHERE s.projectId = :projectId)")
    int deleteByUserIdAndProjectId(@Param("userId") Long userId, @Param("projectId") Long projectId);

    @Query("SELECT sm FROM SubgroupMember sm WHERE sm.id = :memberId")
    Optional<SubgroupMember> findByIdWithUser(@Param("memberId") Long memberId);

    @Query("SELECT sm FROM SubgroupMember sm WHERE sm.subgroupId = :subgroupId AND sm.userId = :userId")
    Optional<SubgroupMember> findBySubgroupIdAndUserId(@Param("subgroupId") Long subgroupId, @Param("userId") Long userId);

    @Query("SELECT sm FROM SubgroupMember sm WHERE sm.userId = :userId AND sm.subgroupId IN " +
            "(SELECT s.id FROM Subgroup s WHERE s.projectId = :projectId)")
    List<SubgroupMember> findByUserIdAndProjectId(@Param("userId") Long userId, @Param("projectId") Long projectId);
}
