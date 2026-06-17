package com.studhub.courses;

import com.studhub.courses.dto.CourseProgressDto;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseRepository courseRepository;
    private final UserRepository userRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseProgressService courseProgressService;

    public CourseController(
            CourseRepository courseRepository,
            UserRepository userRepository,
            EnrollmentRepository enrollmentRepository,
            CourseProgressService courseProgressService
    ) {
        this.courseRepository = courseRepository;
        this.userRepository = userRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.courseProgressService = courseProgressService;
    }

    @GetMapping
    public List<Course> getCourses(Authentication auth) {
        User currentUser = resolveCurrentUser(auth);
        Long userId = (currentUser != null) ? currentUser.getId() : null;

        List<Course> allCourses = courseRepository.findAll();
        List<Course> filteredCourses;

        if (currentUser != null && "STUDENT".equals(currentUser.getRole())) {
            filteredCourses = allCourses.stream()
                    .filter(c -> "ACTIVE".equals(c.getStatus()))
                    .collect(Collectors.toList());
        } else {
            filteredCourses = allCourses;
        }

        for (Course course : filteredCourses) {
            int count = enrollmentRepository.countByCourseId(course.getId());
            course.setEnrollmentCount(count);

            if (userId != null) {
                boolean enrolled = enrollmentRepository.existsByCourseIdAndUserId(course.getId(), userId);
                course.setEnrolled(enrolled);
            } else {
                course.setEnrolled(false);
            }
        }
        return filteredCourses;
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getCourse(@PathVariable Long id, Authentication auth) {
        User user = resolveCurrentUser(auth);
        Course course = courseRepository.findById(id).orElse(null);
        if (course == null) return ResponseEntity.notFound().build();

        if (user != null && "STUDENT".equals(user.getRole()) && !"ACTIVE".equals(course.getStatus())) {
            return ResponseEntity.status(403).body(Map.of("error", "Курс недоступен для студентов"));
        }
        return ResponseEntity.ok(course);
    }

    @PostMapping
    public ResponseEntity<?> createCourse(@RequestBody Course course, Authentication auth) {
        User user = resolveCurrentUserOrThrow(auth);
        if (!"TEACHER".equals(user.getRole()) && !"ADMIN".equals(user.getRole())) {
            return ResponseEntity.status(403).build();
        }
        course.setTeacherId(user.getId());
        if (course.getStatus() == null) course.setStatus("ACTIVE");
        return ResponseEntity.ok(courseRepository.save(course));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> updateCourse(@PathVariable Long id, @RequestBody Map<String, String> updates, Authentication auth) {
        User user = resolveCurrentUserOrThrow(auth);
        Course course = courseRepository.findById(id).orElse(null);
        if (course == null) return ResponseEntity.notFound().build();

        String role = user.getRole();
        boolean isAdmin = "ADMIN".equals(role);
        boolean isTeacher = "TEACHER".equals(role);
        boolean isOwner = course.getTeacherId().equals(user.getId());

        if (!isAdmin && !(isTeacher && isOwner)) {
            return ResponseEntity.status(403).body(Map.of("error", "У вас нет прав на редактирование этого курса"));
        }

        if (updates.containsKey("title") && updates.get("title") != null && !updates.get("title").isBlank()) {
            course.setTitle(updates.get("title"));
        }
        if (updates.containsKey("description")) {
            course.setDescription(updates.get("description"));
        }
        if (updates.containsKey("coverImage")) {
            course.setCoverImage(updates.get("coverImage"));
        }
        if (updates.containsKey("status")) {
            String newStatus = updates.get("status");
            if ("ACTIVE".equals(newStatus) || "INACTIVE".equals(newStatus)) {
                course.setStatus(newStatus);
            }
        }
        return ResponseEntity.ok(courseRepository.save(course));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteCourse(@PathVariable Long id, Authentication auth) {
        User user = resolveCurrentUserOrThrow(auth);
        Course course = courseRepository.findById(id).orElse(null);
        if (course == null) return ResponseEntity.notFound().build();

        String role = user.getRole();
        boolean isAdmin = "ADMIN".equals(role);
        boolean isTeacher = "TEACHER".equals(role);
        boolean isOwner = course.getTeacherId().equals(user.getId());

        if (!isAdmin && !(isTeacher && isOwner)) {
            return ResponseEntity.status(403).body(Map.of("error", "У вас нет прав на удаление этого курса"));
        }

        enrollmentRepository.deleteByCourseId(id);
        courseRepository.delete(course);
        return ResponseEntity.ok(Map.of("message", "Курс удалён"));
    }

    @GetMapping("/{id}/enrollment-status")
    public ResponseEntity<Map<String, Object>> getEnrollmentStatus(@PathVariable Long id, Authentication auth) {
        User user = resolveCurrentUserOrThrow(auth);
        boolean enrolled = enrollmentRepository.existsByCourseIdAndUserId(id, user.getId());
        int studentsCount = enrollmentRepository.countByCourseId(id);
        return ResponseEntity.ok(Map.of("enrolled", enrolled, "studentsCount", studentsCount));
    }

    @GetMapping("/{id}/progress")
    public ResponseEntity<CourseProgressDto> getCourseProgress(@PathVariable Long id, Authentication auth) {
        User user = resolveCurrentUserOrThrow(auth);
        CourseProgressDto progress = courseProgressService.getProgressForUser(id, user.getId(), user.getRole());
        return ResponseEntity.ok(progress);
    }

    @PostMapping("/{id}/enroll")
    @Transactional
    public ResponseEntity<?> enroll(@PathVariable Long id, Authentication auth) {
        User user = resolveCurrentUser(auth);
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Пользователь не найден"));
        Long userId = user.getId();
        Course course = courseRepository.findById(id).orElse(null);
        if (course == null) return ResponseEntity.notFound().build();
        if ("STUDENT".equals(user.getRole()) && !"ACTIVE".equals(course.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Курс неактивен, запись невозможна"));
        }
        boolean exists = enrollmentRepository.existsByCourseIdAndUserId(id, userId);
        if (exists) return ResponseEntity.badRequest().body(Map.of("error", "Уже записан"));
        Enrollment enrollment = new Enrollment();
        enrollment.setCourseId(id);
        enrollment.setUserId(userId);
        enrollmentRepository.save(enrollment);
        return ResponseEntity.ok(Map.of("message", "Записан"));
    }

    @PostMapping("/{id}/unenroll")
    @Transactional
    public ResponseEntity<?> unenroll(@PathVariable Long id, Authentication auth) {
        User user = resolveCurrentUserOrThrow(auth);
        Enrollment enrollment = enrollmentRepository.findByCourseIdAndUserId(id, user.getId()).orElse(null);
        if (enrollment == null) return ResponseEntity.badRequest().body(Map.of("error", "Вы не записаны на этот курс"));
        enrollmentRepository.delete(enrollment);
        return ResponseEntity.ok(Map.of("message", "Вы отписались от курса"));
    }

    private User resolveCurrentUserOrThrow(Authentication auth) {
        User user = resolveCurrentUser(auth);
        if (user == null) {
            throw new IllegalStateException("Пользователь не найден");
        }
        return user;
    }

    private User resolveCurrentUser(Authentication auth) {
        String email = extractEmail(auth);
        return email == null ? null : userRepository.findByEmail(email.toLowerCase()).orElse(null);
    }

    private String extractEmail(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        Object principal = auth.getPrincipal();
        if (principal instanceof OAuth2User oauthUser) {
            String email = oauthUser.getAttribute("default_email");
            if (email == null || email.isBlank()) {
                email = oauthUser.getAttribute("email");
            }
            return email;
        }
        return auth.getName();
    }
}
