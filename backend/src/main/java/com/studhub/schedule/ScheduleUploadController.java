package com.studhub.schedule;

import com.studhub.notification.NotificationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@RestController
@RequestMapping("/api/schedule")
public class ScheduleUploadController {

    private final NotificationService notificationService;

    @Value("${schedule.upload.dir:/app/uploads/schedules}")
    private String uploadDir;

    public ScheduleUploadController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadSchedule(@RequestParam("file") MultipartFile file,
                                            Authentication auth) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Файл не выбран"));
        }

        // Проверяем расширение .xlsx
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || !originalFilename.endsWith(".xlsx")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Поддерживаются только файлы .xlsx"));
        }

        try {
            // Создаём директорию, если её нет
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            // Генерируем уникальное имя файла: исходное имя + дата-время
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd.MM.yyyy_HHmmss"));
            String newFileName = timestamp + "_" + originalFilename;
            Path targetPath = uploadPath.resolve(newFileName);

            // Сохраняем файл
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

            // TODO: здесь вызвать ваш парсер (например, через HTTP к parser:8000)
            // Пример вызова (если парсер работает через REST):
            // restTemplate.postForEntity("http://parser:8000/parse", targetPath.toFile(), String.class);
            // Для простоты считаем, что парсинг прошёл успешно.

            // Получаем имя загрузившего пользователя
            String uploadedBy = auth.getName(); // email или login

            // Создаём уведомления для всех студентов и преподавателей
            notificationService.notifyScheduleUpdate(newFileName, uploadedBy);

            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "filename", newFileName,
                    "message", "Расписание успешно загружено и обработано"
            ));

        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Ошибка сохранения файла: " + e.getMessage()));
        }
    }
}