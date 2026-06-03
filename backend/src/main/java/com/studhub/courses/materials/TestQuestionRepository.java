package com.studhub.courses.materials;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TestQuestionRepository extends JpaRepository<TestQuestion, Long> {
    List<TestQuestion> findByMaterialIdOrderById(Long materialId);
}