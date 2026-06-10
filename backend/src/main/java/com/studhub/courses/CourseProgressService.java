package com.studhub.courses;

import com.studhub.courses.dto.CourseProgressDto;
import com.studhub.courses.materials.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CourseProgressService {

    private final CourseMaterialRepository materialRepository;
    private final MaterialSubmissionRepository submissionRepository;
    private final TestAttemptRepository testAttemptRepository;
    private final EnrollmentRepository enrollmentRepository;

    public CourseProgressService(CourseMaterialRepository materialRepository,
                                 MaterialSubmissionRepository submissionRepository,
                                 TestAttemptRepository testAttemptRepository,
                                 EnrollmentRepository enrollmentRepository) {
        this.materialRepository = materialRepository;
        this.submissionRepository = submissionRepository;
        this.testAttemptRepository = testAttemptRepository;
        this.enrollmentRepository = enrollmentRepository;
    }

    public CourseProgressDto getProgressForUser(Long courseId, Long userId, String role) {
        // Проверка записи для студентов
        if (!"TEACHER".equals(role) && !"ADMIN".equals(role)) {
            if (!enrollmentRepository.existsByCourseIdAndUserId(courseId, userId)) {
                return new CourseProgressDto(0, true);
            }
        }

        List<CourseMaterial> allMaterials = materialRepository.findAllByCourseId(courseId);
        List<CourseMaterial> graded = allMaterials.stream()
                .filter(m -> "ASSIGNMENT".equals(m.getMaterialType()) || "TEST".equals(m.getMaterialType()))
                .toList();

        // Если нет оцениваемых материалов – возвращаем флаг false
        if (graded.isEmpty()) {
            return new CourseProgressDto(0, false);
        }

        long submittedCount = graded.stream()
                .filter(m -> isMaterialCompleted(m, userId))
                .count();

        int percent = (int) (submittedCount * 100 / graded.size());
        return new CourseProgressDto(percent, true);
    }

    private boolean isMaterialCompleted(CourseMaterial material, Long userId) {
        if ("ASSIGNMENT".equals(material.getMaterialType())) {
            return submissionRepository.existsByMaterialIdAndUserId(material.getId(), userId);
        } else if ("TEST".equals(material.getMaterialType())) {
            return testAttemptRepository.existsByMaterialIdAndUserId(material.getId(), userId);
        }
        return false;
    }
}