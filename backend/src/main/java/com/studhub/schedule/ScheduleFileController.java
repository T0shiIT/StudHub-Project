package com.studhub.schedule;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
@RequestMapping("/api/schedule")
public class ScheduleFileController {

    private static final Path SCHEDULE_DIR = Paths.get("/app/uploads/schedules");

    @GetMapping("/download/{filename}")
    public ResponseEntity<Resource> downloadFile(@PathVariable String filename) {
        // Защита от выхода за пределы папки (path traversal)
        Path file = SCHEDULE_DIR.resolve(filename).normalize();
        if (!file.startsWith(SCHEDULE_DIR)) {
            return ResponseEntity.badRequest().build();
        }

        Resource resource = new FileSystemResource(file);
        if (!resource.exists()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header("Content-Disposition", 
                        "attachment; filename=\"" + file.getFileName().toString() + "\"")
                .body(resource);
    }
}