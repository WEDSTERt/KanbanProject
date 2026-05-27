package com.repository;

import com.entity.SubgroupMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface SubgroupMemberRepository extends JpaRepository<SubgroupMember, Long> {
    boolean existsBySubgroupIdAndUserId(Long subgroupId, Long userId);
    
    @Modifying
    @Query("DELETE FROM SubgroupMember sm WHERE sm.userId = :userId AND sm.subgroupId IN " +
           "(SELECT s.id FROM Subgroup s WHERE s.projectId = :projectId)")
    void deleteByUserIdAndProjectId(@Param("userId") Long userId, @Param("projectId") Long projectId);
}
