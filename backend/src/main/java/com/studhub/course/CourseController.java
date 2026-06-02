package com.studhub.course;

import com.studhub.course.dto.*;
import com.studhub.user.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseService courseService;
    private final UserRepository userRepository;

    public CourseController(CourseService courseService, UserRepository userRepository) {
        this.courseService = courseService;
        this.userRepository = userRepository;
    }

    private Long getCurrentUserId(Authentication auth) {
        System.out.println("AUTH = " + auth);
        System.out.println("AUTH NAME = " + auth.getName());
        System.out.println("PRINCIPAL = " + auth.getPrincipal());

        return userRepository.findByEmail(auth.getName())
                .orElseThrow()
                .getId();
    }

    private String getCurrentUserRole(Authentication auth) {
        return userRepository.findByEmail(auth.getName()).orElseThrow().getRole();
    }

    @GetMapping
    public ResponseEntity<List<CourseSummaryDto>> getCourses(Authentication auth) {
        return ResponseEntity.ok(courseService.getCourses(getCurrentUserId(auth), getCurrentUserRole(auth)));
    }

    @GetMapping("/my")
    public ResponseEntity<List<CourseSummaryDto>> getMyCourses(Authentication auth) {
        return ResponseEntity.ok(courseService.getMyCourses(getCurrentUserId(auth)));
    }

    @GetMapping("/{courseId}")
    public ResponseEntity<CourseDto> getCourse(@PathVariable Long courseId, Authentication auth) {
        return ResponseEntity.ok(courseService.getCourse(courseId, getCurrentUserId(auth)));
    }

    @PostMapping
    public ResponseEntity<CourseDto> createCourse(@Valid @RequestBody CreateCourseRequest request, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(courseService.createCourse(request, getCurrentUserId(auth)));
    }

    @PutMapping("/{courseId}")
    public ResponseEntity<CourseDto> updateCourse(@PathVariable Long courseId, @RequestBody UpdateCourseRequest request, Authentication auth) {
        return ResponseEntity.ok(courseService.updateCourse(courseId, request, getCurrentUserId(auth)));
    }

    @DeleteMapping("/{courseId}")
    public ResponseEntity<Void> deleteCourse(@PathVariable Long courseId, Authentication auth) {
        courseService.deleteCourse(courseId, getCurrentUserId(auth));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{courseId}/archive")
    public ResponseEntity<Void> archiveCourse(@PathVariable Long courseId, Authentication auth) {
        courseService.archiveCourse(courseId, getCurrentUserId(auth));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{courseId}/enroll")
    public ResponseEntity<CourseEnrollmentDto> enroll(@PathVariable Long courseId, Authentication auth) {
        return ResponseEntity.ok(courseService.selfEnroll(courseId, getCurrentUserId(auth)));
    }

    @DeleteMapping("/{courseId}/enroll")
    public ResponseEntity<Void> unenroll(@PathVariable Long courseId, Authentication auth) {
        courseService.selfUnenroll(courseId, getCurrentUserId(auth));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{courseId}/members")
    public ResponseEntity<CourseEnrollmentDto> addMember(@PathVariable Long courseId, @Valid @RequestBody AddMemberRequest request, Authentication auth) {
        return ResponseEntity.ok(courseService.addMember(courseId, request, getCurrentUserId(auth)));
    }

    @DeleteMapping("/{courseId}/members/{userId}")
    public ResponseEntity<Void> removeMember(@PathVariable Long courseId, @PathVariable Long userId, Authentication auth) {
        courseService.removeMember(courseId, userId, getCurrentUserId(auth));
        return ResponseEntity.noContent().build();
    }
}