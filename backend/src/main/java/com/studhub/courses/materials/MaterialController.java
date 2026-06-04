package com.studhub.courses.materials;

import com.studhub.courses.Course;
import com.studhub.courses.CourseRepository;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.MediaType;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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
    private final TestQuestionRepository testQuestionRepository;
    private final AnswerOptionRepository answerOptionRepository;
    private final TestAttemptRepository testAttemptRepository;
    private final StudentAnswerRepository studentAnswerRepository;

    private static final Path UPLOAD_BASE;

    static {
        Path appPath = Paths.get("/app");
        if (Files.exists(appPath) && Files.isDirectory(appPath)) {
            UPLOAD_BASE = appPath;
        } else {
            UPLOAD_BASE = Paths.get(System.getProperty("user.dir"));
        }
        System.out.println("MaterialController: UPLOAD_BASE = " + UPLOAD_BASE.toAbsolutePath());
    }

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
    public ResponseEntity<?> createSection(@RequestBody Map<String, Object> body, Authentication auth) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        Long courseId = Long.valueOf(body.get("courseId").toString());
        Course course = courseRepository.findById(courseId).orElse(null);
        if (course == null || !canEditCourse(user, course)) return ResponseEntity.status(403).build();
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
        if (course == null || !canEditCourse(user, course)) return ResponseEntity.status(403).build();

        List<CourseMaterial> materials = materialRepository.findBySectionIdOrderByPosition(sectionId);
        for (CourseMaterial material : materials) {
            List<MaterialSubmission> submissions = submissionRepository.findAll()
                    .stream()
                    .filter(s -> s.getMaterialId().equals(material.getId()))
                    .toList();
            submissionRepository.deleteAll(submissions);
            if ("TEST".equals(material.getMaterialType())) {
                List<TestAttempt> attempts = testAttemptRepository.findByMaterialId(material.getId());
                for (TestAttempt attempt : attempts) {
                    studentAnswerRepository.deleteAll(studentAnswerRepository.findByAttemptId(attempt.getId()));
                    testAttemptRepository.delete(attempt);
                }
                deleteQuestionsForMaterial(material.getId());
            }
            materialRepository.delete(material);
        }
        sectionRepository.delete(section);
        return ResponseEntity.ok(Map.of("message", "Раздел удалён"));
    }

    // ========== MATERIALS ==========
    @PostMapping("/material")
    public ResponseEntity<?> createMaterial(@RequestBody CourseMaterial material, Authentication auth) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseSection section = sectionRepository.findById(material.getSectionId()).orElse(null);
        if (section == null) return ResponseEntity.notFound().build();
        Course course = courseRepository.findById(section.getCourseId()).orElse(null);
        if (course == null || !canEditCourse(user, course)) return ResponseEntity.status(403).build();
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

    // ========== DOWNLOAD FILE ==========
    @GetMapping("/download/{materialId}")
    public ResponseEntity<?> downloadFile(@PathVariable Long materialId, Authentication auth) {
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null || material.getFilePath() == null) {
            return ResponseEntity.notFound().build();
        }

        Path filePath = Paths.get(material.getFilePath());
        if (!Files.exists(filePath)) {
            Path altPath = UPLOAD_BASE.resolve("uploads").resolve("courses").resolve("materials")
                    .resolve(filePath.getFileName());
            if (Files.exists(altPath)) {
                filePath = altPath;
            } else {
                System.err.println("File not found: " + material.getFilePath() + " | alt: " + altPath);
                return ResponseEntity.status(404).body(Map.of("error", "Файл не найден"));
            }
        }

        try {
            byte[] fileBytes = Files.readAllBytes(filePath);
            String fileName = filePath.getFileName().toString();
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8)
                    .replaceAll("\\+", "%20");
            return ResponseEntity.ok()
                    .header("Content-Disposition", "attachment; filename*=UTF-8''" + encodedFileName)
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(fileBytes);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", "Ошибка чтения файла"));
        }
    }

    // ========== UPDATE MATERIAL METADATA ==========
    @PutMapping("/{materialId}")
    public ResponseEntity<?> updateMaterial(@PathVariable Long materialId, @RequestBody CourseMaterial updatedMaterial, Authentication auth) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseMaterial existing = materialRepository.findById(materialId).orElse(null);
        if (existing == null) return ResponseEntity.notFound().build();
        CourseSection section = sectionRepository.findById(existing.getSectionId()).orElse(null);
        if (section == null) return ResponseEntity.notFound().build();
        Course course = courseRepository.findById(section.getCourseId()).orElse(null);
        if (course == null || !canEditCourse(user, course)) return ResponseEntity.status(403).build();

        existing.setTitle(updatedMaterial.getTitle());
        existing.setDescription(updatedMaterial.getDescription());
        existing.setDueDate(updatedMaterial.getDueDate());
        existing.setExternalUrl(updatedMaterial.getExternalUrl());
        materialRepository.save(existing);
        return ResponseEntity.ok(existing);
    }

    // ========== REPLACE FILE ==========
    @PostMapping("/{materialId}/replace-file")
    public ResponseEntity<?> replaceMaterialFile(
            @PathVariable Long materialId,
            @RequestParam("file") MultipartFile file,
            Authentication auth) throws Exception {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null) return ResponseEntity.notFound().build();
        CourseSection section = sectionRepository.findById(material.getSectionId()).orElse(null);
        if (section == null) return ResponseEntity.notFound().build();
        Course course = courseRepository.findById(section.getCourseId()).orElse(null);
        if (course == null || !canEditCourse(user, course)) return ResponseEntity.status(403).build();

        String type = material.getMaterialType();
        if (!"FILE".equals(type) && !"ASSIGNMENT".equals(type))
            return ResponseEntity.badRequest().body(Map.of("error", "Только для файлов и заданий"));

        Path uploadDir = UPLOAD_BASE.resolve("uploads").resolve("courses").resolve("materials");
        Files.createDirectories(uploadDir);
        String fileName = System.currentTimeMillis() + "_" + file.getOriginalFilename();
        Path target = uploadDir.resolve(fileName);
        file.transferTo(target);
        System.out.println("File saved: " + target.toAbsolutePath());

        if (material.getFilePath() != null) {
            try {
                Path oldPath = Paths.get(material.getFilePath());
                if (!oldPath.isAbsolute()) oldPath = UPLOAD_BASE.resolve(oldPath);
                if (Files.exists(oldPath)) Files.delete(oldPath);
            } catch (Exception ignored) {}
        }

        String relativePath = "uploads/courses/materials/" + fileName;
        material.setFilePath(relativePath);
        materialRepository.save(material);
        return ResponseEntity.ok(Map.of("status", "success", "filePath", relativePath, "message", "Файл заменён"));
    }

    // ========== UPDATE TEST QUESTIONS ==========
    @PutMapping("/{materialId}/questions")
    public ResponseEntity<?> updateTestQuestions(
            @PathVariable Long materialId,
            @RequestBody List<Map<String, Object>> questionsData,
            Authentication auth) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null) return ResponseEntity.notFound().build();

        CourseSection section = sectionRepository.findById(material.getSectionId()).orElse(null);
        Course course = section != null ? courseRepository.findById(section.getCourseId()).orElse(null) : null;
        if (course == null || !canEditCourse(user, course)) {
            return ResponseEntity.status(403).build();
        }

        if (!"TEST".equals(material.getMaterialType())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Это не тест"));
        }

        // Удаляем старые вопросы с правильным порядком (FK: question.correctOption → answer_option)
        deleteQuestionsForMaterial(materialId);

        // Создаём новые вопросы
        for (Map<String, Object> qData : questionsData) {
            String text = (String) qData.get("text");
            if (text == null || text.isBlank()) continue;

            List<String> options = (List<String>) qData.get("options");
            if (options == null || options.isEmpty()) continue;

            int correctIndex = parseCorrectIndex(qData.get("correctOptionIndex"));

            TestQuestion question = new TestQuestion();
            question.setText(text);
            question.setMaterial(material);
            testQuestionRepository.save(question);

            List<AnswerOption> optEntities = new ArrayList<>();
            for (String optText : options) {
                AnswerOption opt = new AnswerOption();
                opt.setText(optText);
                opt.setQuestion(question);
                optEntities.add(opt);
            }
            answerOptionRepository.saveAll(optEntities);

            if (correctIndex < 0 || correctIndex >= optEntities.size()) {
                System.err.println("Invalid correctIndex " + correctIndex + " for question '" + text + "', using 0");
                correctIndex = 0;
            }
            question.setCorrectOption(optEntities.get(correctIndex));
            testQuestionRepository.save(question);
        }

        return ResponseEntity.ok(Map.of("message", "Вопросы обновлены"));
    }

    // ========== DELETE MATERIAL ==========
    @DeleteMapping("/{materialId}")
    public ResponseEntity<?> deleteMaterial(@PathVariable Long materialId, Authentication auth) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null) return ResponseEntity.notFound().build();
        CourseSection section = sectionRepository.findById(material.getSectionId()).orElse(null);
        if (section == null) return ResponseEntity.notFound().build();
        Course course = courseRepository.findById(section.getCourseId()).orElse(null);
        if (course == null || !canEditCourse(user, course)) return ResponseEntity.status(403).build();

        List<MaterialSubmission> submissions = submissionRepository.findAll()
                .stream()
                .filter(s -> s.getMaterialId().equals(materialId))
                .toList();
        submissionRepository.deleteAll(submissions);

        if ("TEST".equals(material.getMaterialType())) {
            List<TestAttempt> attempts = testAttemptRepository.findByMaterialId(materialId);
            for (TestAttempt attempt : attempts) {
                studentAnswerRepository.deleteAll(studentAnswerRepository.findByAttemptId(attempt.getId()));
                testAttemptRepository.delete(attempt);
            }
            deleteQuestionsForMaterial(materialId);
        }
        materialRepository.delete(material);
        return ResponseEntity.ok(Map.of("message", "Материал удалён"));
    }

    // ========== FILE UPLOAD FOR TEACHERS ==========
    @PostMapping("/material/{materialId}/upload-file")
    public ResponseEntity<?> uploadMaterialFile(
            @PathVariable Long materialId,
            @RequestParam("file") MultipartFile file,
            Authentication auth) throws Exception {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null) return ResponseEntity.notFound().build();
        CourseSection section = sectionRepository.findById(material.getSectionId()).orElse(null);
        if (section == null) return ResponseEntity.notFound().build();
        Course course = courseRepository.findById(section.getCourseId()).orElse(null);
        if (course == null || !canEditCourse(user, course)) return ResponseEntity.status(403).build();

        Path uploadDir = UPLOAD_BASE.resolve("uploads").resolve("courses").resolve("materials");
        Files.createDirectories(uploadDir);
        String fileName = System.currentTimeMillis() + "_" + file.getOriginalFilename();
        Path target = uploadDir.resolve(fileName);
        file.transferTo(target);
        System.out.println("File uploaded: " + target.toAbsolutePath());

        String relativePath = "uploads/courses/materials/" + fileName;
        material.setFilePath(relativePath);
        materialRepository.save(material);
        return ResponseEntity.ok(Map.of("status", "success", "filePath", relativePath, "message", "Файл загружен"));
    }

    // ========== SUBMISSIONS ==========
    @PostMapping("/{materialId}/submit")
    public ResponseEntity<?> submitAssignment(
            @PathVariable Long materialId,
            @RequestParam("file") MultipartFile file,
            Authentication auth) throws Exception {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null) return ResponseEntity.notFound().build();

        Path uploadDir = UPLOAD_BASE.resolve("uploads").resolve("courses").resolve("submissions");
        Files.createDirectories(uploadDir);
        String originalFilename = file.getOriginalFilename();
        String fileName = System.currentTimeMillis() + "_" + user.getId() + "_" + originalFilename;
        Path target = uploadDir.resolve(fileName);
        file.transferTo(target);
        System.out.println("Submission saved: " + target.toAbsolutePath());

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
        return ResponseEntity.ok(Map.of("status", "completed", "message", "Файл загружен"));
    }

    @GetMapping("/{materialId}/status")
    public ResponseEntity<?> getStatus(@PathVariable Long materialId, Authentication auth) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        boolean completed = submissionRepository
                .findByMaterialIdAndUserId(materialId, user.getId())
                .isPresent();
        return ResponseEntity.ok(Map.of("completed", completed, "status", completed ? "Выполнено" : "Надо сделать"));
    }

    @GetMapping("/{materialId}/submissions")
    public ResponseEntity<?> getSubmissions(@PathVariable Long materialId, Authentication auth) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null) return ResponseEntity.notFound().build();
        CourseSection section = sectionRepository.findById(material.getSectionId()).orElse(null);
        if (section == null) return ResponseEntity.notFound().build();
        Course course = courseRepository.findById(section.getCourseId()).orElse(null);
        if (course == null || !canEditCourse(user, course)) return ResponseEntity.status(403).build();

        List<MaterialSubmission> submissions = submissionRepository.findAll()
                .stream()
                .filter(s -> s.getMaterialId().equals(materialId))
                .toList();
        return ResponseEntity.ok(submissions);
    }

    // ========== TESTS ==========
    @PostMapping("/{materialId}/questions")
    public ResponseEntity<?> addQuestion(@PathVariable Long materialId, @RequestBody Map<String, Object> body, Authentication auth) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        CourseMaterial material = materialRepository.findById(materialId).orElse(null);
        if (material == null) return ResponseEntity.notFound().build();
        CourseSection section = sectionRepository.findById(material.getSectionId()).orElse(null);
        Course course = section != null ? courseRepository.findById(section.getCourseId()).orElse(null) : null;
        if (course == null || !canEditCourse(user, course)) return ResponseEntity.status(403).build();

        String questionText = (String) body.get("text");
        List<String> optionTexts = (List<String>) body.get("options");
        int correctIndex = parseCorrectIndex(body.get("correctOptionIndex"));

        TestQuestion question = new TestQuestion();
        question.setText(questionText);
        question.setMaterial(material);
        testQuestionRepository.save(question);

        List<AnswerOption> options = new ArrayList<>();
        for (String optText : optionTexts) {
            AnswerOption opt = new AnswerOption();
            opt.setText(optText);
            opt.setQuestion(question);
            options.add(opt);
        }
        answerOptionRepository.saveAll(options);
        if (correctIndex < 0 || correctIndex >= options.size()) correctIndex = 0;
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
            // Используем HashMap вместо Map.of() — он поддерживает null-значения
            Map<String, Object> qMap = new HashMap<>();
            qMap.put("id", q.getId());
            qMap.put("text", q.getText());
            qMap.put("correctOptionId", q.getCorrectOption() != null ? q.getCorrectOption().getId() : null);
            qMap.put("options", opts.stream()
                    .map(opt -> Map.of("id", opt.getId(), "text", opt.getText()))
                    .collect(Collectors.toList()));
            result.add(qMap);
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{materialId}/submit-test")
    public ResponseEntity<?> submitTest(@PathVariable Long materialId, @RequestBody Map<Long, Long> answers, Authentication auth) {
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
            if (selectedId != null && q.getCorrectOption() != null && selectedId.equals(q.getCorrectOption().getId())) {
                correctCount++;
            }
        }
        int percent = questions.isEmpty() ? 0 : (correctCount * 100) / questions.size();

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
        if (attempt.isEmpty()) return ResponseEntity.ok(Map.of("completed", false));
        return ResponseEntity.ok(Map.of("completed", true, "scorePercent", attempt.get().getScorePercent()));
    }

    // ========== HELPERS ==========

    private boolean canEditCourse(User user, Course course) {
        return "ADMIN".equals(user.getRole()) || course.getTeacherId().equals(user.getId());
    }

    /**
     * Правильный порядок удаления вопросов теста:
     * 1. Сначала обнуляем FK question.correctOption → null (иначе нельзя удалить AnswerOption)
     * 2. Удаляем StudentAnswer по questionId
     * 3. Удаляем AnswerOption
     * 4. Удаляем TestQuestion
     */
    private void deleteQuestionsForMaterial(Long materialId) {
        List<TestQuestion> questions = testQuestionRepository.findByMaterialIdOrderById(materialId);
        for (TestQuestion q : questions) {
            // Шаг 1: обнуляем correctOption чтобы снять FK-ограничение
            q.setCorrectOption(null);
            testQuestionRepository.save(q);
        }
        for (TestQuestion q : questions) {
            // Шаг 2: удаляем StudentAnswer
            List<StudentAnswer> studentAnswers = studentAnswerRepository.findByQuestionId(q.getId());
            if (!studentAnswers.isEmpty()) {
                studentAnswerRepository.deleteAll(studentAnswers);
            }
            // Шаг 3: удаляем AnswerOption
            List<AnswerOption> opts = answerOptionRepository.findByQuestionId(q.getId());
            if (!opts.isEmpty()) {
                answerOptionRepository.deleteAll(opts);
            }
            // Шаг 4: удаляем сам вопрос
            testQuestionRepository.delete(q);
        }
    }

    /**
     * Безопасное извлечение correctOptionIndex из Map (Integer, Long или String)
     */
    private int parseCorrectIndex(Object correctObj) {
        if (correctObj == null) return 0;
        if (correctObj instanceof Integer) return (Integer) correctObj;
        if (correctObj instanceof Long) return ((Long) correctObj).intValue();
        if (correctObj instanceof String) {
            try {
                return Integer.parseInt((String) correctObj);
            } catch (NumberFormatException e) {
                return 0;
            }
        }
        return 0;
    }
}