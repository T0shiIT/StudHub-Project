package com.studhub.courses.materials;

import com.studhub.courses.Course;
import com.studhub.courses.CourseRepository;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/materials")
public class MaterialController {

    private final CourseRepository courseRepository;
    private final UserRepository userRepository;
    private final CourseSectionRepository sectionRepository;
    private final CourseMaterialRepository materialRepository;
    private final MaterialSubmissionRepository submissionRepository;
    // Репозитории для тестов
    private final TestQuestionRepository testQuestionRepository;
    private final AnswerOptionRepository answerOptionRepository;
    private final TestAttemptRepository testAttemptRepository;
    private final StudentAnswerRepository studentAnswerRepository;

    public MaterialController(
            CourseRepository courseRepository,
            UserRepository userRepository,
            CourseSectionRepository sectionRepository,
            CourseMaterialRepository materialRepository,
            MaterialSubmissionRepository submissionRepository,
            TestQuestionRepository testQuestionRepository,
            AnswerOptionRepository answerOptionRepository,
            TestAttemptRepository testAttemptRepository,
            StudentAnswerRepository studentAnswerRepository
    ) {
        this.courseRepository = courseRepository;
        this.userRepository = userRepository;
        this.sectionRepository = sectionRepository;
        this.materialRepository = materialRepository;
        this.submissionRepository = submissionRepository;
        this.testQuestionRepository = testQuestionRepository;
        this.answerOptionRepository = answerOptionRepository;
        this.testAttemptRepository = testAttemptRepository;
        this.studentAnswerRepository = studentAnswerRepository;
    }

    // ========== SECTIONS ==========

    @PostMapping("/sections")
    public ResponseEntity<?> createSection(
            @RequestBody Map<String, Object> body,
            Authentication auth
    ) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        Long courseId = Long.valueOf(body.get("courseId").toString());

        Course course = courseRepository.findById(courseId).orElse(null);
        if (course == null) return ResponseEntity.notFound().build();

        if (!canEditCourse(user, course)) {
            return ResponseEntity.status(403).build();
        }

        CourseSection section = new CourseSection();
        section.setCourseId(courseId);
        section.setTitle(body.get("title").toString());
        section.setPosition(Integer.parseInt(body.getOrDefault("position", "0").toString()));

        return ResponseEntity.ok(sectionRepository.save(section));
    }

    @GetMapping("/course/{courseId}/sections")
    public ResponseEntity<?> getSections(@PathVariable Long courseId) {
        return ResponseEntity.ok(sectionRepository.findByCourseIdOrderByPosition(courseId));
    }

    @DeleteMapping("/sections/{sectionId}")
    public ResponseEntity<?> deleteSection(@PathVariable Long sectionId, Authentication auth) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseSection section = sectionRepository.findById(sectionId).orElse(null);
        if (section == null) return ResponseEntity.notFound().build();

        Course course = courseRepository.findById(section.getCourseId()).orElse(null);
        if (course == null || !canEditCourse(user, course)) {
            return ResponseEntity.status(403).build();
        }

        List<CourseMaterial> materials = materialRepository.findBySectionIdOrderByPosition(sectionId);
        for (CourseMaterial material : materials) {
            // Удаляем submissions
            List<MaterialSubmission> submissions = submissionRepository.findAll()
                    .stream()
                    .filter(s -> s.getMaterialId().equals(material.getId()))
                    .toList();
            submissionRepository.deleteAll(submissions);
            // Если это тест – удаляем тестовые данные
            if ("TEST".equals(material.getMaterialType())) {
                List<TestAttempt> attempts = testAttemptRepository.findByMaterialId(material.getId());
                for (TestAttempt attempt : attempts) {
                    studentAnswerRepository.deleteAll(studentAnswerRepository.findByAttemptId(attempt.getId()));
                    testAttemptRepository.delete(attempt);
                }
                List<TestQuestion> questions = testQuestionRepository.findByMaterialIdOrderById(material.getId());
                for (TestQuestion q : questions) {
                    studentAnswerRepository.deleteAll(studentAnswerRepository.findByQuestionId(q.getId()));
                    testQuestionRepository.delete(q);
                }
            }
            materialRepository.delete(material);
        }
        sectionRepository.delete(section);
        return ResponseEntity.ok(Map.of("message", "Раздел и все его материалы удалены"));
    }

    // ========== MATERIALS ==========

    @PostMapping("/material")
    public ResponseEntity<?> createMaterial(
            @RequestBody CourseMaterial material,
            Authentication auth
    ) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseSection section = sectionRepository.findById(material.getSectionId()).orElse(null);
        if (section == null) return ResponseEntity.notFound().build();

        Course course = courseRepository.findById(section.getCourseId()).orElse(null);
        if (course == null || !canEditCourse(user, course)) {
            return ResponseEntity.status(403).build();
        }

        return ResponseEntity.ok(materialRepository.save(material));
    }

    @GetMapping("/section/{sectionId}")
    public ResponseEntity<?> getMaterials(@PathVariable Long sectionId) {
        return ResponseEntity.ok(materialRepository.findBySectionIdOrderByPosition(sectionId));
    }

    @GetMapping("/{materialId}")
    public ResponseEntity<?> getMaterial(@PathVariable Long materialId) {
        return materialRepository.findById(materialId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ========== ИСПРАВЛЕННЫЙ deleteMaterial (полное удаление тестов) ==========
    @DeleteMapping("/{materialId}")
    public ResponseEntity<?> deleteMaterial(@PathVariable Long materialId, Authentication auth) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null) return ResponseEntity.notFound().build();

        CourseSection section = sectionRepository.findById(material.getSectionId()).orElse(null);
        if (section == null) return ResponseEntity.notFound().build();

        Course course = courseRepository.findById(section.getCourseId()).orElse(null);
        if (course == null || !canEditCourse(user, course)) {
            return ResponseEntity.status(403).build();
        }

        // 1. Удаляем submissions (для заданий)
        List<MaterialSubmission> submissions = submissionRepository.findAll()
                .stream()
                .filter(s -> s.getMaterialId().equals(materialId))
                .toList();
        submissionRepository.deleteAll(submissions);

        // 2. Если материал – тест, удаляем все связанные данные
        if ("TEST".equals(material.getMaterialType())) {
            // 2a. Удаляем попытки и ответы студентов
            List<TestAttempt> attempts = testAttemptRepository.findByMaterialId(materialId);
            for (TestAttempt attempt : attempts) {
                List<StudentAnswer> answers = studentAnswerRepository.findByAttemptId(attempt.getId());
                studentAnswerRepository.deleteAll(answers);
                testAttemptRepository.delete(attempt);
            }
            // 2b. Удаляем вопросы и варианты ответов
            List<TestQuestion> questions = testQuestionRepository.findByMaterialIdOrderById(materialId);
            for (TestQuestion question : questions) {
                // Удаляем ответы студентов, связанные с вопросом (если остались)
                List<StudentAnswer> answersByQuestion = studentAnswerRepository.findByQuestionId(question.getId());
                studentAnswerRepository.deleteAll(answersByQuestion);
                // Варианты ответов удалятся каскадно из-за cascade = ALL
                testQuestionRepository.delete(question);
            }
        }

        // 3. Удаляем сам материал
        materialRepository.delete(material);

        return ResponseEntity.ok(Map.of("message", "Материал и все связанные данные удалены"));
    }

    // ========== FILE UPLOAD FOR TEACHERS ==========

    @PostMapping("/material/{materialId}/upload-file")
    public ResponseEntity<?> uploadMaterialFile(
            @PathVariable Long materialId,
            @RequestParam("file") MultipartFile file,
            Authentication auth
    ) throws Exception {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null) return ResponseEntity.notFound().build();

        CourseSection section = sectionRepository.findById(material.getSectionId()).orElse(null);
        if (section == null) return ResponseEntity.notFound().build();

        Course course = courseRepository.findById(section.getCourseId()).orElse(null);
        if (course == null || !canEditCourse(user, course)) {
            return ResponseEntity.status(403).build();
        }

        Path uploadDir = Paths.get("uploads/courses/materials");
        Files.createDirectories(uploadDir);

        String fileName = System.currentTimeMillis() + "_" + file.getOriginalFilename();
        Path target = uploadDir.resolve(fileName);
        file.transferTo(target);

        material.setFilePath(target.toString());
        materialRepository.save(material);

        return ResponseEntity.ok(Map.of(
                "status", "success",
                "filePath", target.toString(),
                "message", "Файл загружен"
        ));
    }

    // ========== SUBMISSIONS (for assignments) ==========

    @PostMapping("/{materialId}/submit")
    public ResponseEntity<?> submitAssignment(
            @PathVariable Long materialId,
            @RequestParam("file") MultipartFile file,
            Authentication auth
    ) throws Exception {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null) return ResponseEntity.notFound().build();

        Path uploadDir = Paths.get("uploads/courses/submissions");
        Files.createDirectories(uploadDir);

        String originalFilename = file.getOriginalFilename();
        String fileName = System.currentTimeMillis() + "_" + user.getId() + "_" + originalFilename;
        Path target = uploadDir.resolve(fileName);
        file.transferTo(target);

        MaterialSubmission submission = submissionRepository
                .findByMaterialIdAndUserId(materialId, user.getId())
                .orElse(new MaterialSubmission());

        submission.setMaterialId(materialId);
        submission.setUserId(user.getId());
        submission.setFilePath(target.toString());
        submission.setOriginalFilename(originalFilename);
        submission.setSubmittedAt(Instant.now());
        submission.setStatus("SUBMITTED");

        submissionRepository.save(submission);

        return ResponseEntity.ok(Map.of(
                "status", "completed",
                "message", "Файл загружен"
        ));
    }

    @GetMapping("/{materialId}/status")
    public ResponseEntity<?> getStatus(@PathVariable Long materialId, Authentication auth) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();

        boolean completed = submissionRepository
                .findByMaterialIdAndUserId(materialId, user.getId())
                .isPresent();

        return ResponseEntity.ok(Map.of(
                "completed", completed,
                "status", completed ? "Выполнено" : "Надо сделать"
        ));
    }

    @GetMapping("/{materialId}/submissions")
    public ResponseEntity<?> getSubmissions(
            @PathVariable Long materialId,
            Authentication auth
    ) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null) return ResponseEntity.notFound().build();

        CourseSection section = sectionRepository.findById(material.getSectionId()).orElse(null);
        if (section == null) return ResponseEntity.notFound().build();

        Course course = courseRepository.findById(section.getCourseId()).orElse(null);
        if (course == null || !canEditCourse(user, course)) {
            return ResponseEntity.status(403).build();
        }

        List<MaterialSubmission> submissions = submissionRepository.findAll()
                .stream()
                .filter(s -> s.getMaterialId().equals(materialId))
                .toList();

        return ResponseEntity.ok(submissions);
    }

    // ========== TESTS ==========

    @PostMapping("/{materialId}/questions")
    public ResponseEntity<?> addQuestion(@PathVariable Long materialId,
                                         @RequestBody Map<String, Object> body,
                                         Authentication auth) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null) return ResponseEntity.notFound().build();

        CourseSection section = sectionRepository.findById(material.getSectionId()).orElse(null);
        Course course = section != null ? courseRepository.findById(section.getCourseId()).orElse(null) : null;
        if (course == null || !canEditCourse(user, course)) {
            return ResponseEntity.status(403).build();
        }

        String questionText = (String) body.get("text");
        List<String> optionTexts = (List<String>) body.get("options");
        int correctIndex = (int) body.get("correctOptionIndex");

        TestQuestion question = new TestQuestion();
        question.setText(questionText);
        question.setMaterial(material);
        testQuestionRepository.save(question);

        List<AnswerOption> options = new ArrayList<>();
        for (int i = 0; i < optionTexts.size(); i++) {
            AnswerOption opt = new AnswerOption();
            opt.setText(optionTexts.get(i));
            opt.setQuestion(question);
            options.add(opt);
        }
        answerOptionRepository.saveAll(options);

        question.setCorrectOption(options.get(correctIndex));
        testQuestionRepository.save(question);

        return ResponseEntity.ok(Map.of("id", question.getId()));
    }

    @GetMapping("/{materialId}/questions")
    public ResponseEntity<?> getQuestions(@PathVariable Long materialId) {
        List<TestQuestion> questions = testQuestionRepository.findByMaterialIdOrderById(materialId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (TestQuestion q : questions) {
            List<AnswerOption> opts = answerOptionRepository.findByQuestionId(q.getId());
            result.add(Map.of(
                    "id", q.getId(),
                    "text", q.getText(),
                    "options", opts.stream()
                            .map(opt -> Map.of("id", opt.getId(), "text", opt.getText()))
                            .collect(Collectors.toList())
            ));
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{materialId}/submit-test")
    public ResponseEntity<?> submitTest(@PathVariable Long materialId,
                                        @RequestBody Map<Long, Long> answers,
                                        Authentication auth) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null) return ResponseEntity.notFound().build();

        Optional<TestAttempt> existing = testAttemptRepository.findByMaterialIdAndUserId(materialId, user.getId());
        if (existing.isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Вы уже прошли этот тест"));
        }

        List<TestQuestion> questions = testQuestionRepository.findByMaterialIdOrderById(materialId);
        int correctCount = 0;
        for (TestQuestion q : questions) {
            Long selectedId = answers.get(q.getId());
            if (selectedId != null && selectedId.equals(q.getCorrectOption().getId())) {
                correctCount++;
            }
        }
        int percent = (correctCount * 100) / questions.size();

        TestAttempt attempt = new TestAttempt();
        attempt.setMaterialId(materialId);
        attempt.setUserId(user.getId());
        attempt.setScorePercent(percent);
        attempt.setCompletedAt(Instant.now());
        testAttemptRepository.save(attempt);

        for (Map.Entry<Long, Long> entry : answers.entrySet()) {
            StudentAnswer sa = new StudentAnswer();
            sa.setAttemptId(attempt.getId());
            sa.setQuestionId(entry.getKey());
            sa.setSelectedOptionId(entry.getValue());
            studentAnswerRepository.save(sa);
        }

        return ResponseEntity.ok(Map.of("scorePercent", percent));
    }

    @GetMapping("/{materialId}/test-result")
    public ResponseEntity<?> getTestResult(@PathVariable Long materialId, Authentication auth) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        Optional<TestAttempt> attempt = testAttemptRepository.findByMaterialIdAndUserId(materialId, user.getId());
        if (attempt.isEmpty()) {
            return ResponseEntity.ok(Map.of("completed", false));
        }
        return ResponseEntity.ok(Map.of("completed", true, "scorePercent", attempt.get().getScorePercent()));
    }

    // ========== HELPERS ==========

    private boolean canEditCourse(User user, Course course) {
        return "ADMIN".equals(user.getRole()) ||
                course.getTeacherId().equals(user.getId());
    }
}