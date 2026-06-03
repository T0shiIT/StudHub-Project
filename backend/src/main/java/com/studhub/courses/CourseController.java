package com.studhub.courses;

import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseRepository courseRepository;
    private final UserRepository userRepository;
    private final EnrollmentRepository enrollmentRepository;

    public CourseController(
            CourseRepository courseRepository,
            UserRepository userRepository,
            EnrollmentRepository enrollmentRepository
    ) {
        this.courseRepository = courseRepository;
        this.userRepository = userRepository;
        this.enrollmentRepository = enrollmentRepository;
    }

    // ИСПРАВЛЕННЫЙ МЕТОД: используем countByCourseId и existsByCourseIdAndUserId
    @GetMapping
    public List<Course> getCourses(Authentication auth) {
        User currentUser = userRepository.findByEmail(auth.getName()).orElse(null);
        Long userId = (currentUser != null) ? currentUser.getId() : null;

        List<Course> courses = courseRepository.findAll();

        for (Course course : courses) {
            // Количество студентов
            int count = enrollmentRepository.countByCourseId(course.getId());
            course.setEnrollmentCount(count);

            // Статус записи текущего пользователя
            if (userId != null) {
                boolean enrolled = enrollmentRepository.existsByCourseIdAndUserId(course.getId(), userId);
                course.setEnrolled(enrolled);
                System.out.println("Course " + course.getId() + " -> enrolled=" + enrolled);
            } else {
                course.setEnrolled(false);
            }
        }
        return courses;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Course> getCourse(@PathVariable Long id) {
        return courseRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createCourse(
            @RequestBody Course course,
            Authentication auth
    ) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();

        if (!"TEACHER".equals(user.getRole()) && !"ADMIN".equals(user.getRole())) {
            return ResponseEntity.status(403).build();
        }

        course.setTeacherId(user.getId());
        return ResponseEntity.ok(courseRepository.save(course));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<?> updateCourse(
            @PathVariable Long id,
            @RequestBody Map<String, String> updates,
            Authentication auth
    ) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        Course course = courseRepository.findById(id).orElse(null);

        if (course == null) {
            return ResponseEntity.notFound().build();
        }

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

        return ResponseEntity.ok(courseRepository.save(course));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteCourse(
            @PathVariable Long id,
            Authentication auth
    ) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        Course course = courseRepository.findById(id).orElse(null);

        if (course == null) {
            return ResponseEntity.notFound().build();
        }

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
    public ResponseEntity<Map<String, Object>> getEnrollmentStatus(
            @PathVariable Long id,
            Authentication auth
    ) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();

        boolean enrolled = enrollmentRepository.existsByCourseIdAndUserId(id, user.getId());
        int studentsCount = enrollmentRepository.countByCourseId(id);

        return ResponseEntity.ok(Map.of(
                "enrolled", enrolled,
                "studentsCount", studentsCount
        ));
    }

    // ИСПРАВЛЕННЫЙ МЕТОД ЗАПИСИ – с логами и принудительным flush
    @PostMapping("/{id}/enroll")
    @Transactional
    public ResponseEntity<?> enroll(
            @PathVariable Long id,
            Authentication auth
    ) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();
        Long userId = user.getId();

        System.out.println("=== ENROLL REQUEST ===");
        System.out.println("Course ID: " + id);
        System.out.println("User ID: " + userId);

        boolean exists = enrollmentRepository.existsByCourseIdAndUserId(id, userId);
        System.out.println("Already enrolled? " + exists);

        if (exists) {
            return ResponseEntity.badRequest().body(Map.of("error", "Уже записан"));
        }

        Enrollment enrollment = new Enrollment();
        enrollment.setCourseId(id);
        enrollment.setUserId(userId);
        enrollmentRepository.save(enrollment);
        enrollmentRepository.flush(); // принудительно сбрасываем в БД

        System.out.println("Enrollment saved. New count: " + enrollmentRepository.countByCourseId(id));

        return ResponseEntity.ok(Map.of("message", "Записан"));
    }

    @PostMapping("/{id}/unenroll")
    @Transactional
    public ResponseEntity<?> unenroll(
            @PathVariable Long id,
            Authentication auth
    ) {
        User user = userRepository.findByEmail(auth.getName()).orElseThrow();

        Enrollment enrollment = enrollmentRepository
                .findByCourseIdAndUserId(id, user.getId())
                .orElse(null);

        if (enrollment == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Вы не записаны на этот курс"));
        }

        enrollmentRepository.delete(enrollment);
        return ResponseEntity.ok(Map.of("message", "Вы отписались от курса"));
    }
}