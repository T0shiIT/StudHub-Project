package com.studhub.controller;

import com.studhub.service.ExcelImportService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/upload")
public class UploadController {

    private final ExcelImportService excelImportService;

    public UploadController(ExcelImportService excelImportService) {
        this.excelImportService = excelImportService;
    }

    @PostMapping("/excel")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<?> uploadExcel(@RequestParam("file") MultipartFile file) {
        try {
            excelImportService.importFile(file);
            return ResponseEntity.ok(Map.of("message", "Файл успешно загружен и обработан"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}