package com.studhub.grade;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.studhub.auth.CppUserClient;
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

@RestController
@RequestMapping("/api/grades")
public class GradeController {

    private final GradeService gradeService;
    private final UserRepository userRepository;
    private final ScheduleParserClient parserClient;
    private final ObjectMapper objectMapper;

    public GradeController(GradeService gradeService,
                           UserRepository userRepository,
                           ScheduleParserClient parserClient,
                           ObjectMapper objectMapper) {
        this.gradeService = gradeService;
        this.userRepository = userRepository;
        this.parserClient = parserClient;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public ResponseEntity<?> getGrades(@RequestParam(required = false) String group,
                                       @RequestParam(required = false) String subject,
                                       Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String email = auth.getName();
        User currentUser = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if ("STUDENT".equals(currentUser.getRole())) {
            List<GradeDto> grades = gradeService.getGradesForStudent(currentUser.getId());
            return ResponseEntity.ok(grades);
        }

        if (group == null || group.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Parameter 'group' is required for teacher/admin"));
        }
        List<GradeDto> grades = gradeService.getGradesForGroup(group, subject);
        return ResponseEntity.ok(grades);
    }

    @PatchMapping("/{gradeId}")
    public ResponseEntity<?> updateGrade(@PathVariable Long gradeId,
                                         @Valid @RequestBody UpdateGradeRequest request,
                                         Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String email = auth.getName();
        User teacher = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!"TEACHER".equals(teacher.getRole()) && !"ADMIN".equals(teacher.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Insufficient permissions"));
        }

        try {
            GradeDto updated = gradeService.updateGrade(gradeId, request, teacher.getId());
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadGrades(@RequestParam("file") MultipartFile file,
                                          Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String email = auth.getName();
        User teacher = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!"TEACHER".equals(teacher.getRole()) && !"ADMIN".equals(teacher.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Only teachers and admins can upload grades"));
        }

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }

        try {
            String jsonString = parserClient.parseToJson(file);
            JsonNode root = objectMapper.readTree(jsonString);
            JsonNode sheets = root.path("sheets");
            if (!sheets.isArray() || sheets.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "No sheets found in Excel"));
            }

            // Берём первый лист
            JsonNode firstSheet = sheets.get(0);
            JsonNode records = firstSheet.path("records");
            if (!records.isArray()) {
                return ResponseEntity.badRequest().body(Map.of("error", "No records found in sheet"));
            }

            int processed = 0;
            int failed = 0;
            DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");

            for (JsonNode record : records) {
                try {
                    String studentEmail = record.path("student_email").asText();
                    String subject = record.path("subject").asText();
                    String gradeValue = record.path("grade").asText();
                    String dateStr = record.path("date").asText();

                    if (studentEmail.isBlank() || subject.isBlank() || gradeValue.isBlank() || dateStr.isBlank()) {
                        failed++;
                        continue;
                    }

                    User student = userRepository.findByEmail(studentEmail)
                            .orElseThrow(() -> new RuntimeException("Student not found: " + studentEmail));
                    LocalDate date = LocalDate.parse(dateStr, dateFormatter);

                    gradeService.saveGrade(student, subject, gradeValue, date, teacher);
                    processed++;
                } catch (Exception e) {
                    failed++;
                }
            }

            GradeUploadResponse response = new GradeUploadResponse();
            response.setProcessed(processed);
            response.setFailed(failed);
            response.setMessage("Upload completed");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to process file: " + e.getMessage()));
        }
    }
}