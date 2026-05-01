package com.studhub.schedule;

import com.studhub.auth.CppUserClient;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/schedule")
public class ScheduleController {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".xlsx", ".xlsm", ".xlsb", ".xls");
    private static final com.fasterxml.jackson.databind.ObjectMapper MAPPER = new com.fasterxml.jackson.databind.ObjectMapper();

    private final CppUserClient cppUserClient;
    private final ScheduleParserClient scheduleParserClient;

    public ScheduleController(CppUserClient cppUserClient,
                              ScheduleParserClient scheduleParserClient) {
        this.cppUserClient = cppUserClient;
        this.scheduleParserClient = scheduleParserClient;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadSchedule(@RequestParam("file") MultipartFile file, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Пользователь не авторизован"));
        }

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Файл пустой"));
        }

        String originalName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String extension = extractExtension(originalName);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Поддерживаются форматы: .xlsx, .xlsm, .xlsb, .xls"));
        }

        String scheduleJson;
        try {
            scheduleJson = scheduleParserClient.parseToJson(file);
        } catch (IllegalStateException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Ошибка парсинга файла: " + e.getMessage()));
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("file_name", originalName);
        payload.put("file_type", extension);
        payload.put("uploaded_by", authentication.getName());
        try {
            payload.put("schedule_json", parseJsonObject(scheduleJson));
        } catch (IllegalStateException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }

        CppUserClient.Result saveResult = cppUserClient.uploadSchedule(payload);
        if (!saveResult.isSuccess()) {
            return ResponseEntity.status(saveResult.status()).body(saveResult.body());
        }

        return ResponseEntity.ok(Map.of(
                "message", "Расписание успешно загружено",
                "saved", saveResult.body()
        ));
    }

    @GetMapping("/latest")
    public ResponseEntity<?> latestSchedule() {
        CppUserClient.Result result = cppUserClient.latestSchedule();
        return ResponseEntity.status(result.status()).body(result.body());
    }

    private String extractExtension(String fileName) {
        int idx = fileName.lastIndexOf('.');
        if (idx == -1) {
            return "";
        }
        return fileName.substring(idx).toLowerCase();
    }

    private Object parseJsonObject(String json) {
        try {
            return MAPPER.readValue(json, Object.class);
        } catch (Exception e) {
            throw new IllegalStateException("Некорректный JSON от parser сервиса");
        }
    }
}
