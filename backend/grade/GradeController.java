package com.studhub.grade;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studhub.grade.dto.GradeDto;
import com.studhub.grade.dto.GradeUploadResponse;
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

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/grades")
public class GradeController {

    private final GradeService gradeService;
    private final UserRepository userRepository;
    private final ScheduleParserClient parserClient;
    private final ObjectMapper objectMapper;

    public GradeController(GradeService gradeService, UserRepository userRepository,
                           ScheduleParserClient parserClient, ObjectMapper objectMapper) {
        this.gradeService = gradeService;
        this.userRepository = userRepository;
        this.parserClient = parserClient;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public ResponseEntity<?> getGrades(@RequestParam(required = false) String group,
                                       @RequestParam(required = false) String subject,
                                       Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        String email = auth.getName();
        User currentUser = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));

        if ("STUDENT".equalsIgnoreCase(currentUser.getRole())) {
            return ResponseEntity.ok(gradeService.getGradesForStudent(currentUser.getId()));
        }

        if (group == null || group.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Parameter 'group' is required for teacher/admin"));
        }
        return ResponseEntity.ok(gradeService.getGradesForGroup(group, subject));
    }

    @PatchMapping("/{gradeId}")
    public ResponseEntity<?> updateGrade(@PathVariable Long gradeId, @Valid @RequestBody UpdateGradeRequest request, Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        String email = auth.getName();
        User teacher = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));

        if (!"TEACHER".equalsIgnoreCase(teacher.getRole()) && !"ADMIN".equalsIgnoreCase(teacher.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Insufficient permissions"));
        }

        try {
            return ResponseEntity.ok(gradeService.updateGrade(gradeId, request, teacher.getId()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadGrades(@RequestParam("file") MultipartFile file, Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        String email = auth.getName();
        User teacher = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));

        if (!"TEACHER".equalsIgnoreCase(teacher.getRole()) && !"ADMIN".equalsIgnoreCase(teacher.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Only teachers and admins can upload grades"));
        }
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));

        try {
            String jsonString = parserClient.parseToJson(file);
            JsonNode root = objectMapper.readTree(jsonString);
            JsonNode sheets = root.path("sheets");
            if (!sheets.isArray() || sheets.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "No sheets found"));

            JsonNode records = sheets.get(0).path("records");
            if (!records.isArray()) return ResponseEntity.badRequest().body(Map.of("error", "No records found"));

            // Оптимизация: собираем все email и делаем один запрос в БД
            List<String> emails = new ArrayList<>();
            for (JsonNode record : records) {
                String sEmail = record.path("student_email").asText();
                if (!sEmail.isBlank()) emails.add(sEmail);
            }
            
            Map<String, User> studentsMap = userRepository.findAllByEmailIn(emails).stream()
                    .collect(Collectors.toMap(User::getEmail, u -> u, (a, b) -> a));

            int processed = 0, failed = 0;
            DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");

            for (JsonNode record : records) {
                try {
                    String studentEmail = record.path("student_email").asText();
                    String subject = record.path("subject").asText();
                    String gradeValue = record.path("grade").asText();
                    String dateStr = record.path("date").asText();

                    if (studentEmail.isBlank() || subject.isBlank() || gradeValue.isBlank() || dateStr.isBlank()) {
                        failed++; continue;
                    }

                    User student = studentsMap.get(studentEmail);
                    if (student == null) { failed++; continue; }

                    LocalDate date = LocalDate.parse(dateStr, dateFormatter);
                    gradeService.saveGrade(student, subject, gradeValue, date, teacher);
                    processed++;
                } catch (Exception e) {
                    failed++;
                }
            }

            return ResponseEntity.ok(new GradeUploadResponse(processed, failed, "Upload completed"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Failed to process file: " + e.getMessage()));
        }
    }
}