package com.studhub.courses.materials;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AnswerOptionRepository extends JpaRepository<AnswerOption, Long> {
    List<AnswerOption> findByQuestionId(Long questionId);
}