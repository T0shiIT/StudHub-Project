package com.studhub.courses.materials;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface MaterialSubmissionRepository extends JpaRepository<MaterialSubmission, Long> {
    Optional<MaterialSubmission> findByMaterialIdAndUserId(Long materialId, Long userId);
}