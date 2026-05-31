package com.studhub.course;

import com.studhub.course.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseService courseService;

    @GetMapping
    public ResponseEntity<List<CourseDto>> getActiveCourses() {
        return ResponseEntity.ok(courseService.getActiveCourses());
    }

    @GetMapping("/{courseId}")
    public ResponseEntity<CourseDto> getCourse(@PathVariable Long courseId, Authentication auth) {
        Long userId = getUserId(auth);
        return ResponseEntity.ok(courseService.getCourse(courseId, userId));
    }

    @PostMapping
    public ResponseEntity<CourseDto> createCourse(@Valid @RequestBody CreateCourseRequest request,
                                                  Authentication auth) {
        Long userId = getUserId(auth);
        return ResponseEntity.status(HttpStatus.CREATED).body(courseService.createCourse(request, userId));
    }

    @PutMapping("/{courseId}")
    public ResponseEntity<CourseDto> updateCourse(@PathVariable Long courseId,
                                                  @RequestBody UpdateCourseRequest request,
                                                  Authentication auth) {
        Long userId = getUserId(auth);
        return ResponseEntity.ok(courseService.updateCourse(courseId, request, userId));
    }

    @DeleteMapping("/{courseId}")
    public ResponseEntity<Void> deleteCourse(@PathVariable Long courseId, Authentication auth) {
        Long userId = getUserId(auth);
        courseService.deleteCourse(courseId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{courseId}/archive")
    public ResponseEntity<Void> archiveCourse(@PathVariable Long courseId, Authentication auth) {
        Long userId = getUserId(auth);
        courseService.archiveCourse(courseId, userId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{courseId}/members")
    public ResponseEntity<Void> addMember(@PathVariable Long courseId,
                                          @Valid @RequestBody AddMemberRequest request,
                                          Authentication auth) {
        Long userId = getUserId(auth);
        courseService.addMember(courseId, request.getUserId(), userId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{courseId}/members/{userId}")
    public ResponseEntity<Void> removeMember(@PathVariable Long courseId,
                                             @PathVariable Long userId,
                                             Authentication auth) {
        Long currentUserId = getUserId(auth);
        courseService.removeMember(courseId, userId, currentUserId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{courseId}/records")
    public ResponseEntity<CourseRecordDto> addRecord(@PathVariable Long courseId,
                                                     @Valid @RequestBody CourseRecordDto recordDto,
                                                     Authentication auth) {
        Long userId = getUserId(auth);
        return ResponseEntity.status(HttpStatus.CREATED).body(courseService.addRecord(courseId, recordDto, userId));
    }

    private Long getUserId(Authentication auth) {
        // Здесь должна быть логика извлечения id пользователя из auth (JWT или session)
        // Для примера: auth.getName() может быть email, ищем в БД
        return 1L; // заглушка
    }
}