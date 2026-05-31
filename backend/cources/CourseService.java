package com.studhub.course;

import com.studhub.course.dto.*;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CourseService {

    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CourseRecordRepository recordRepository;
    private final UserRepository userRepository;

    @Transactional
    public CourseDto createCourse(CreateCourseRequest request, Long currentUserId) {
        User teacher = userRepository.findById(request.getTeacherId())
                .orElseThrow(() -> new RuntimeException("Teacher not found"));
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new RuntimeException("Current user not found"));
        if (!currentUser.getRole().equals("ADMIN") && !currentUser.getId().equals(teacher.getId())) {
            throw new RuntimeException("You cannot create course for another teacher");
        }
        Course course = new Course();
        course.setTitle(request.getTitle());
        course.setDescription(request.getDescription());
        course.setTeacher(teacher);
        course = courseRepository.save(course);
        return toDto(course);
    }

    @Transactional
    public CourseDto updateCourse(Long courseId, UpdateCourseRequest request, Long currentUserId) {
        Course course = findCourseAndCheckPermissions(courseId, currentUserId);
        if (request.getTitle() != null) course.setTitle(request.getTitle());
        if (request.getDescription() != null) course.setDescription(request.getDescription());
        if (request.getArchived() != null) course.setArchived(request.getArchived());
        return toDto(courseRepository.save(course));
    }

    @Transactional
    public void deleteCourse(Long courseId, Long currentUserId) {
        Course course = findCourseAndCheckPermissions(courseId, currentUserId);
        course.setDeleted(true);
        courseRepository.save(course);
    }

    @Transactional
    public void archiveCourse(Long courseId, Long currentUserId) {
        Course course = findCourseAndCheckPermissions(courseId, currentUserId);
        course.setArchived(true);
        courseRepository.save(course);
    }

    @Transactional
    public void addMember(Long courseId, Long userId, Long currentUserId) {
        Course course = findCourseAndCheckPermissions(courseId, currentUserId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (enrollmentRepository.findByCourseIdAndUserId(courseId, userId).isPresent()) {
            throw new RuntimeException("User already enrolled");
        }
        Enrollment enrollment = new Enrollment();
        enrollment.setCourse(course);
        enrollment.setUser(user);
        enrollmentRepository.save(enrollment);
    }

    @Transactional
    public void removeMember(Long courseId, Long userId, Long currentUserId) {
        Course course = findCourseAndCheckPermissions(courseId, currentUserId);
        enrollmentRepository.deleteByCourseIdAndUserId(courseId, userId);
    }

    @Transactional
    public CourseRecordDto addRecord(Long courseId, CourseRecordDto recordDto, Long currentUserId) {
        Course course = findCourseAndCheckPermissions(courseId, currentUserId);
        CourseRecord record = new CourseRecord();
        record.setCourse(course);
        record.setTitle(recordDto.getTitle());
        record.setContent(recordDto.getContent());
        record.setRecordType(recordDto.getRecordType());
        record.setDueDate(recordDto.getDueDate());
        record = recordRepository.save(record);
        return toRecordDto(record);
    }

    @Transactional(readOnly = true)
    public List<CourseDto> getActiveCourses() {
        return courseRepository.findByDeletedFalseAndArchivedFalse().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CourseDto getCourse(Long courseId, Long currentUserId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new RuntimeException("Course not found"));
        // проверка на просмотр: если удалён – только для участников или админа
        if (course.isDeleted() && !isAdmin(currentUserId) && !isMember(currentUserId, courseId)) {
            throw new RuntimeException("Course is deleted");
        }
        return toDto(course);
    }

    private Course findCourseAndCheckPermissions(Long courseId, Long currentUserId) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new RuntimeException("Course not found"));
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        boolean isAdmin = "ADMIN".equals(currentUser.getRole());
        boolean isTeacher = course.getTeacher().getId().equals(currentUserId);
        if (!isAdmin && !isTeacher) {
            throw new RuntimeException("You are not allowed to modify this course");
        }
        return course;
    }

    private boolean isAdmin(Long userId) {
        return userRepository.findById(userId)
                .map(u -> "ADMIN".equals(u.getRole()))
                .orElse(false);
    }

    private boolean isMember(Long userId, Long courseId) {
        return enrollmentRepository.findByCourseIdAndUserId(courseId, userId).isPresent();
    }

    private CourseDto toDto(Course course) {
        CourseDto dto = new CourseDto();
        dto.setId(course.getId());
        dto.setTitle(course.getTitle());
        dto.setDescription(course.getDescription());
        dto.setTeacherId(course.getTeacher().getId());
        dto.setTeacherName(course.getTeacher().getFirstName() + " " + course.getTeacher().getLastName());
        dto.setArchived(course.isArchived());
        dto.setEnrollments(course.getEnrollments().stream().map(this::toEnrollmentDto).collect(Collectors.toList()));
        dto.setRecords(course.getRecords().stream().map(this::toRecordDto).collect(Collectors.toList()));
        return dto;
    }

    private EnrollmentDto toEnrollmentDto(Enrollment e) {
        EnrollmentDto dto = new EnrollmentDto();
        dto.setUserId(e.getUser().getId());
        dto.setUserFullName(e.getUser().getFirstName() + " " + e.getUser().getLastName());
        dto.setEnrolledAt(e.getEnrolledAt());
        return dto;
    }

    private CourseRecordDto toRecordDto(CourseRecord r) {
        CourseRecordDto dto = new CourseRecordDto();
        dto.setId(r.getId());
        dto.setTitle(r.getTitle());
        dto.setContent(r.getContent());
        dto.setRecordType(r.getRecordType());
        dto.setDueDate(r.getDueDate());
        dto.setCreatedAt(r.getCreatedAt());
        return dto;
    }
}