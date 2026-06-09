package com.studhub.courses.materials;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface TestAttemptRepository extends JpaRepository<TestAttempt, Long> {
    Optional<TestAttempt> findByMaterialIdAndUserId(Long materialId, Long userId);

    List<TestAttempt> findByMaterialId(Long materialId);

    // Добавлено: проверка существования попытки теста
    boolean existsByMaterialIdAndUserId(Long materialId, Long userId);
}