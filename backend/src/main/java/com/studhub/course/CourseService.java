package com.studhub.course;

import com.studhub.course.dto.*;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class CourseService {

    private final CourseRepository courseRepo;
    private final CourseEnrollmentRepository enrollmentRepo;
    private final UserRepository userRepo;

    public CourseService(CourseRepository courseRepo, CourseEnrollmentRepository enrollmentRepo, UserRepository userRepo) {
        this.courseRepo = courseRepo;
        this.enrollmentRepo = enrollmentRepo;
        this.userRepo = userRepo;
    }

    @Cacheable(value = "courses", key = "#userId + ':' + #userRole")
    @Transactional(readOnly = true)
    public List<CourseSummaryDto> getCourses(Long userId, String userRole) {
        List<Course> courses;
        if ("ADMIN".equalsIgnoreCase(userRole)) {
            courses = courseRepo.findAllNotDeleted();
        } else {
            List<Course> active = courseRepo.findByStatusAndVisibleTrue(CourseStatus.ACTIVE);
            List<Course> enrolled = courseRepo.findEnrolledCourses(userId);
            courses = active;
            for (Course c : enrolled) {
                if (courses.stream().noneMatch(course -> course.getId().equals(c.getId()))) {
                    courses.add(c);
                }
            }
        }
        return courses.stream().map(c -> toSummaryDto(c, userId)).collect(Collectors.toList());
    }

    @Cacheable(value = "myCourses", key = "#userId")
    @Transactional(readOnly = true)
    public List<CourseSummaryDto> getMyCourses(Long userId) {
        List<Course> owned = courseRepo.findOwnedCourses(userId);
        List<Course> enrolled = courseRepo.findEnrolledCourses(userId);
        for (Course e : enrolled) {
            if (owned.stream().noneMatch(c -> c.getId().equals(e.getId()))) {
                owned.add(e);
            }
        }
        return owned.stream().map(c -> toSummaryDto(c, userId)).collect(Collectors.toList());
    }

    @Cacheable(value = "course", key = "#courseId + ':' + #userId")
    @Transactional(readOnly = true)
    public CourseDto getCourse(Long courseId, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        CourseEnrollment enrollment = enrollmentRepo.findByCourseIdAndUserId(courseId, userId).orElse(null);
        if (!CoursePermissionService.canViewCourse(course, user, enrollment)) {
            throw CourseException.forbidden("Нет доступа к курсу");
        }
        return toDto(course, userId, enrollment);
    }

    @Caching(evict = {@CacheEvict(value = "courses", allEntries = true), @CacheEvict(value = "myCourses", allEntries = true)})
    @Transactional
    public CourseDto createCourse(CreateCourseRequest req, Long userId) {
        User owner = requireUser(userId);
        if (!"TEACHER".equalsIgnoreCase(owner.getRole()) && !"ADMIN".equalsIgnoreCase(owner.getRole())) {
            throw CourseException.forbidden("Только преподаватели и администраторы могут создавать курсы");
        }
        Course course = new Course();
        course.setTitle(req.getTitle().trim());
        course.setDescription(req.getDescription());
        course.setShortName(req.getShortName());
        course.setCategory(req.getCategory());
        course.setVisible(req.isVisible());
        course.setEnrollmentOpen(req.isEnrollmentOpen());
        course.setOwner(owner);
        course = courseRepo.save(course);
        return toDto(course, userId, null);
    }

    @Caching(evict = {@CacheEvict(value = "courses", allEntries = true), @CacheEvict(value = "myCourses", allEntries = true), @CacheEvict(value = "course", allEntries = true)})
    @Transactional
    public CourseDto updateCourse(Long courseId, UpdateCourseRequest req, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        requireManageCourse(course, user);
        if (req.getTitle() != null) course.setTitle(req.getTitle().trim());
        if (req.getDescription() != null) course.setDescription(req.getDescription());
        if (req.getShortName() != null) course.setShortName(req.getShortName());
        if (req.getCategory() != null) course.setCategory(req.getCategory());
        if (req.getVisible() != null) course.setVisible(req.getVisible());
        if (req.getEnrollmentOpen() != null) course.setEnrollmentOpen(req.getEnrollmentOpen());
        course = courseRepo.save(course);
        return toDto(course, userId, null);
    }

    @Caching(evict = {@CacheEvict(value = "courses", allEntries = true), @CacheEvict(value = "myCourses", allEntries = true), @CacheEvict(value = "course", allEntries = true)})
    @Transactional
    public void deleteCourse(Long courseId, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        requireManageCourse(course, user);
        course.setStatus(CourseStatus.DELETED);
        courseRepo.save(course);
    }

    @Caching(evict = {@CacheEvict(value = "courses", allEntries = true), @CacheEvict(value = "myCourses", allEntries = true), @CacheEvict(value = "course", allEntries = true)})
    @Transactional
    public void archiveCourse(Long courseId, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        requireManageCourse(course, user);
        if (course.getStatus() == CourseStatus.DELETED) throw CourseException.badRequest("Нельзя архивировать удалённый курс");
        course.setStatus(CourseStatus.ARCHIVED);
        courseRepo.save(course);
    }

    @Caching(evict = {@CacheEvict(value = "courses", allEntries = true), @CacheEvict(value = "myCourses", allEntries = true), @CacheEvict(value = "course", key = "#courseId + ':' + #userId")})
    @Transactional
    public CourseEnrollmentDto selfEnroll(Long courseId, Long userId) {
        Course course = requireCourse(courseId);
        if (!CoursePermissionService.canSelfEnroll(course)) throw CourseException.forbidden("Самостоятельная запись закрыта");
        if (enrollmentRepo.existsByCourseIdAndUserId(courseId, userId)) throw CourseException.conflict("Вы уже записаны");
        User user = requireUser(userId);
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setCourse(course);
        enrollment.setUser(user);
        enrollment.setCourseRole("STUDENT");
        enrollment = enrollmentRepo.save(enrollment);
        return toEnrollmentDto(enrollment);
    }

    @Caching(evict = {@CacheEvict(value = "courses", allEntries = true), @CacheEvict(value = "myCourses", allEntries = true), @CacheEvict(value = "course", key = "#courseId + ':' + #userId")})
    @Transactional
    public void selfUnenroll(Long courseId, Long userId) {
        Course course = requireCourse(courseId);
        if (course.getOwner().getId().equals(userId)) throw CourseException.forbidden("Владелец не может покинуть курс");
        if (!enrollmentRepo.existsByCourseIdAndUserId(courseId, userId)) throw CourseException.notFound("Запись");
        enrollmentRepo.deleteByCourseIdAndUserId(courseId, userId);
    }

    @Caching(evict = {@CacheEvict(value = "courses", allEntries = true), @CacheEvict(value = "myCourses", allEntries = true), @CacheEvict(value = "course", key = "#courseId + ':' + #currentUserId")})
    @Transactional
    public CourseEnrollmentDto addMember(Long courseId, AddMemberRequest req, Long currentUserId) {
        Course course = requireCourse(courseId);
        User manager = requireUser(currentUserId);
        requireManageCourse(course, manager);
        User target = requireUser(req.getUserId());
        if (enrollmentRepo.existsByCourseIdAndUserId(courseId, target.getId())) throw CourseException.conflict("Пользователь уже записан");
        String role = "STUDENT".equalsIgnoreCase(req.getCourseRole()) ? "STUDENT" : "TEACHER";
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setCourse(course);
        enrollment.setUser(target);
        enrollment.setCourseRole(role);
        enrollment = enrollmentRepo.save(enrollment);
        return toEnrollmentDto(enrollment);
    }

    @Caching(evict = {@CacheEvict(value = "courses", allEntries = true), @CacheEvict(value = "myCourses", allEntries = true), @CacheEvict(value = "course", key = "#courseId + ':' + #currentUserId")})
    @Transactional
    public void removeMember(Long courseId, Long targetUserId, Long currentUserId) {
        Course course = requireCourse(courseId);
        User manager = requireUser(currentUserId);
        if (course.getOwner().getId().equals(targetUserId)) throw CourseException.forbidden("Нельзя удалить владельца");
        boolean isSelf = currentUserId.equals(targetUserId);
        if (!isSelf && !CoursePermissionService.canManageCourse(course, manager)) throw CourseException.forbidden("Недостаточно прав");
        if (!enrollmentRepo.existsByCourseIdAndUserId(courseId, targetUserId)) throw CourseException.notFound("Участник");
        enrollmentRepo.deleteByCourseIdAndUserId(courseId, targetUserId);
    }

    private Course requireCourse(Long id) {
        return courseRepo.findById(id).orElseThrow(() -> CourseException.notFound("Курс"));
    }

    private User requireUser(Long id) {
        return userRepo.findById(id).orElseThrow(() -> new CourseException("Пользователь не найден", HttpStatus.NOT_FOUND));
    }

    private void requireManageCourse(Course course, User user) {
        if (!CoursePermissionService.canManageCourse(course, user)) throw CourseException.forbidden("Недостаточно прав");
    }

    private CourseSummaryDto toSummaryDto(Course c, Long currentUserId) {
        CourseSummaryDto dto = new CourseSummaryDto();
        dto.setId(c.getId());
        dto.setTitle(c.getTitle());
        dto.setShortName(c.getShortName());
        dto.setCategory(c.getCategory());
        dto.setStatus(c.getStatus());
        dto.setVisible(c.isVisible());
        dto.setEnrollmentOpen(c.isEnrollmentOpen());
        dto.setOwnerId(c.getOwner().getId());
        dto.setOwnerName(c.getOwner().getFirstName() + " " + c.getOwner().getLastName());
        dto.setEnrollmentCount(c.getEnrollments().size());
        dto.setCreatedAt(c.getCreatedAt());
        if (c.getOwner().getId().equals(currentUserId)) {
            dto.setMyRole("OWNER");
        } else {
            c.getEnrollments().stream().filter(e -> e.getUser().getId().equals(currentUserId)).findFirst().ifPresent(e -> dto.setMyRole(e.getCourseRole()));
        }
        return dto;
    }

    private CourseDto toDto(Course c, Long currentUserId, CourseEnrollment currentEnrollment) {
        CourseDto dto = new CourseDto();
        dto.setId(c.getId());
        dto.setTitle(c.getTitle());
        dto.setDescription(c.getDescription());
        dto.setShortName(c.getShortName());
        dto.setCategory(c.getCategory());
        dto.setStatus(c.getStatus());
        dto.setVisible(c.isVisible());
        dto.setEnrollmentOpen(c.isEnrollmentOpen());
        dto.setOwnerId(c.getOwner().getId());
        dto.setOwnerName(c.getOwner().getFirstName() + " " + c.getOwner().getLastName());
        dto.setCreatedAt(c.getCreatedAt());
        dto.setUpdatedAt(c.getUpdatedAt());
        dto.setEnrollments(c.getEnrollments().stream().map(this::toEnrollmentDto).collect(Collectors.toList()));
        if (c.getOwner().getId().equals(currentUserId)) {
            dto.setMyRole("OWNER");
        } else if (currentEnrollment != null) {
            dto.setMyRole(currentEnrollment.getCourseRole());
        }
        return dto;
    }

    private CourseEnrollmentDto toEnrollmentDto(CourseEnrollment e) {
        CourseEnrollmentDto dto = new CourseEnrollmentDto();
        dto.setUserId(e.getUser().getId());
        dto.setUserFullName(e.getUser().getFirstName() + " " + e.getUser().getLastName());
        dto.setUserEmail(e.getUser().getEmail());
        dto.setUserLogin(e.getUser().getLogin());
        dto.setCourseRole(e.getCourseRole());
        dto.setEnrolledAt(e.getEnrolledAt());
        return dto;
    }
}