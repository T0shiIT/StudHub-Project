package com.studhub.grade;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studhub.courses.Course;
import com.studhub.courses.CourseRepository;
import com.studhub.grade.dto.CreateGradeRequest;
import com.studhub.grade.dto.GradeDto;
import com.studhub.grade.dto.SavePreviewRequest;
import com.studhub.grade.dto.UpdateColumnDateRequest;
import com.studhub.grade.dto.UpdateGradeDateRequest;
import com.studhub.grade.dto.UpdateGradeRequest;
import com.studhub.schedule.ScheduleParserClient;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/grades")
public class GradeController {

    private final GradeService gradeService;
    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final ScheduleParserClient parserClient;
    private final ObjectMapper objectMapper;

    public GradeController(GradeService gradeService,
                           UserRepository userRepository,
                           CourseRepository courseRepository,
                           ScheduleParserClient parserClient,
                           ObjectMapper objectMapper) {
        this.gradeService = gradeService;
        this.userRepository = userRepository;
        this.courseRepository = courseRepository;
        this.parserClient = parserClient;
        this.objectMapper = objectMapper;
    }

    // Получить журнал для курса (для студентов и учителей)
    @GetMapping("/course/{courseId}")
    public ResponseEntity<?> getGradesForCourse(@PathVariable Long courseId,
                                                @RequestParam(required = false) String group,
                                                Authentication auth) {
        if (auth == null || !auth.isAuthenticated())
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        Course course = courseRepository.findById(courseId).orElse(null);
        if (course == null) return ResponseEntity.notFound().build();

        if ("STUDENT".equalsIgnoreCase(user.getRole())) {
            String studentGroup = user.getGroupName();
            if (studentGroup == null) return ResponseEntity.ok(List.of());
            return ResponseEntity.ok(gradeService.getGradesForGroup(courseId, studentGroup, null));
        } else {
            if (group == null || group.isBlank())
                return ResponseEntity.badRequest().body(Map.of("error", "Parameter 'group' is required for teacher/admin"));
            return ResponseEntity.ok(gradeService.getGradesForGroup(courseId, group, null));
        }
    }

    // Получить список групп для курса (только учитель/админ)
    @GetMapping("/course/{courseId}/groups")
    public ResponseEntity<?> getGroupsForCourse(@PathVariable Long courseId, Authentication auth) {
        if (auth == null || !auth.isAuthenticated())
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        if (!"TEACHER".equalsIgnoreCase(user.getRole()) && !"ADMIN".equalsIgnoreCase(user.getRole()))
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));

        List<String> groups = userRepository.findDistinctGroupNamesByCourseId(courseId);
        return ResponseEntity.ok(groups);
    }

    // Обновить дату для целой колонки
    @PatchMapping("/course/{courseId}/date-column")
    public ResponseEntity<?> updateColumnDate(@PathVariable Long courseId,
                                              @Valid @RequestBody UpdateColumnDateRequest request,
                                              Authentication auth) {
        if (auth == null || !auth.isAuthenticated())
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User teacher = userRepository.findByEmail(auth.getName()).orElseThrow();
        if (!"TEACHER".equalsIgnoreCase(teacher.getRole()) && !"ADMIN".equalsIgnoreCase(teacher.getRole()))
            return ResponseEntity.status(403).body(Map.of("error", "Insufficient permissions"));

        try {
            int updated = gradeService.updateColumnDate(courseId, request.getGroup(), request.getSubject(),
                    request.getOldDate(), request.getNewDate(), teacher.getId());
            return ResponseEntity.ok(Map.of("updated", updated, "message", "Обновлено " + updated + " оценок"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        }
    }

    // Создать новую оценку
    @PostMapping
    public ResponseEntity<?> createGrade(@Valid @RequestBody CreateGradeRequest request, Authentication auth) {
        if (auth == null || !auth.isAuthenticated())
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User teacher = userRepository.findByEmail(auth.getName()).orElseThrow();
        if (!"TEACHER".equalsIgnoreCase(teacher.getRole()) && !"ADMIN".equalsIgnoreCase(teacher.getRole()))
            return ResponseEntity.status(403).body(Map.of("error", "Only teachers and admins can create grades"));

        try {
            GradeDto created = gradeService.createGrade(request, teacher.getId());
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    // Обновить оценку
    @PatchMapping("/{gradeId}")
    public ResponseEntity<?> updateGrade(@PathVariable Long gradeId,
                                         @Valid @RequestBody UpdateGradeRequest request,
                                         Authentication auth) {
        if (auth == null || !auth.isAuthenticated())
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User teacher = userRepository.findByEmail(auth.getName()).orElseThrow();
        if (!"TEACHER".equalsIgnoreCase(teacher.getRole()) && !"ADMIN".equalsIgnoreCase(teacher.getRole()))
            return ResponseEntity.status(403).body(Map.of("error", "Insufficient permissions"));

        try {
            GradeDto updated = gradeService.updateGrade(gradeId, request, teacher.getId());
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    // Обновить дату оценки
    @PatchMapping("/{gradeId}/date")
    public ResponseEntity<?> updateGradeDate(@PathVariable Long gradeId,
                                             @Valid @RequestBody UpdateGradeDateRequest request,
                                             Authentication auth) {
        if (auth == null || !auth.isAuthenticated())
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User teacher = userRepository.findByEmail(auth.getName()).orElseThrow();
        if (!"TEACHER".equalsIgnoreCase(teacher.getRole()) && !"ADMIN".equalsIgnoreCase(teacher.getRole()))
            return ResponseEntity.status(403).body(Map.of("error", "Insufficient permissions"));

        try {
            GradeDto updated = gradeService.updateGradeDate(gradeId, request.getDate(), teacher.getId());
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    // ======================== ЗАГРУЗКА EXCEL (ПРЕДПРОСМОТР) ========================
    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> previewExcel(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }
        try {
            String jsonString = parserClient.parseToJson(file);
            JsonNode root = objectMapper.readTree(jsonString);
            return ResponseEntity.ok(root);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/save-preview")
    public ResponseEntity<?> savePreview(@Valid @RequestBody SavePreviewRequest request, Authentication auth) {
        if (auth == null || !auth.isAuthenticated())
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        String email = auth.getName();
        User teacher = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!"TEACHER".equalsIgnoreCase(teacher.getRole()) && !"ADMIN".equalsIgnoreCase(teacher.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Insufficient permissions"));
        }

        try {
            int saved = gradeService.savePreview(request, teacher.getId());
            return ResponseEntity.ok(Map.of("saved", saved, "message", "Saved " + saved + " grades"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}