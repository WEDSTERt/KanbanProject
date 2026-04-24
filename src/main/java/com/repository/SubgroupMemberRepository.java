package com.repository;

import com.entity.SubgroupMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SubgroupMemberRepository extends JpaRepository<SubgroupMember, Long> {


    boolean existsBySubgroupIdAndUserId(Long subgroupId, Long userId);
}