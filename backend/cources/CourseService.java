package com.studhub.course;

import com.studhub.course.assignment.Assignment;
import com.studhub.course.assignment.AssignmentRepository;
import com.studhub.course.assignment.AssignmentStatus;
import com.studhub.course.assignment.dto.AssignmentDto;
import com.studhub.course.assignment.dto.CreateAssignmentRequest;
import com.studhub.course.assignment.dto.UpdateAssignmentRequest;
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
    private final AssignmentRepository assignmentRepo;
    private final UserRepository userRepo;

    public CourseService(CourseRepository courseRepo,
                         CourseEnrollmentRepository enrollmentRepo,
                         AssignmentRepository assignmentRepo,
                         UserRepository userRepo) {
        this.courseRepo = courseRepo;
        this.enrollmentRepo = enrollmentRepo;
        this.assignmentRepo = assignmentRepo;
        this.userRepo = userRepo;
    }

    // =========================================================
    //  Получение курсов
    // =========================================================

    /**
     * Список курсов, доступных текущему пользователю:
     * — ADMIN видит все не-удалённые
     * — TEACHER/STUDENT видит активные+видимые + свои записанные
     */
    @Cacheable(value = "courses", key = "#userId + ':' + #userRole")
    @Transactional(readOnly = true)
    public List<CourseSummaryDto> getCourses(Long userId, String userRole) {
        List<Course> courses;
        if ("ADMIN".equalsIgnoreCase(userRole)) {
            courses = courseRepo.findAllNotDeleted();
        } else {
            // Видимые активные + те, на которые записан
            List<Course> active = courseRepo.findByStatusAndVisibleTrue(CourseStatus.ACTIVE);
            List<Course> enrolled = courseRepo.findEnrolledCourses(userId);
            // Объединяем без дублей
            courses = active;
            for (Course e : enrolled) {
                if (courses.stream().noneMatch(c -> c.getId().equals(e.getId()))) {
                    courses.add(e);
                }
            }
        }
        return courses.stream()
                .map(c -> toSummary(c, userId))
                .collect(Collectors.toList());
    }

    /**
     * Мои курсы (в которых я создатель или записан)
     */
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
        return owned.stream()
                .map(c -> toSummary(c, userId))
                .collect(Collectors.toList());
    }

    /**
     * Полная информация о курсе
     */
    @Cacheable(value = "course", key = "#courseId + ':' + #userId")
    @Transactional(readOnly = true)
    public CourseDto getCourse(Long courseId, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        CourseEnrollment enrollment = enrollmentRepo.findByCourseIdAndUserId(courseId, userId).orElse(null);

        if (!CoursePermissionService.canViewCourse(course, user, enrollment)) {
            throw CourseException.forbidden("Нет доступа к этому курсу");
        }
        return toDto(course, userId, enrollment);
    }

    // =========================================================
    //  Создание / редактирование / архив / удаление курса
    // =========================================================

    @Caching(evict = {
            @CacheEvict(value = "courses",   allEntries = true),
            @CacheEvict(value = "myCourses", allEntries = true)
    })
    @Transactional
    public CourseDto createCourse(CreateCourseRequest req, Long userId) {
        User owner = requireUser(userId);
        // Создавать курс могут TEACHER и ADMIN
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

    @Caching(evict = {
            @CacheEvict(value = "courses",   allEntries = true),
            @CacheEvict(value = "myCourses", allEntries = true),
            @CacheEvict(value = "course",    allEntries = true)
    })
    @Transactional
    public CourseDto updateCourse(Long courseId, UpdateCourseRequest req, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        requireManageCourse(course, user);

        if (req.getTitle() != null)          course.setTitle(req.getTitle().trim());
        if (req.getDescription() != null)    course.setDescription(req.getDescription());
        if (req.getShortName() != null)      course.setShortName(req.getShortName());
        if (req.getCategory() != null)       course.setCategory(req.getCategory());
        if (req.getVisible() != null)        course.setVisible(req.getVisible());
        if (req.getEnrollmentOpen() != null) course.setEnrollmentOpen(req.getEnrollmentOpen());

        course = courseRepo.save(course);
        CourseEnrollment enrollment = enrollmentRepo.findByCourseIdAndUserId(courseId, userId).orElse(null);
        return toDto(course, userId, enrollment);
    }

    @Caching(evict = {
            @CacheEvict(value = "courses",   allEntries = true),
            @CacheEvict(value = "myCourses", allEntries = true),
            @CacheEvict(value = "course",    allEntries = true)
    })
    @Transactional
    public void archiveCourse(Long courseId, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        requireManageCourse(course, user);
        if (course.getStatus() == CourseStatus.DELETED) {
            throw CourseException.badRequest("Нельзя архивировать удалённый курс");
        }
        course.setStatus(CourseStatus.ARCHIVED);
        courseRepo.save(course);
    }

    @Caching(evict = {
            @CacheEvict(value = "courses",   allEntries = true),
            @CacheEvict(value = "myCourses", allEntries = true),
            @CacheEvict(value = "course",    allEntries = true)
    })
    @Transactional
    public void restoreCourse(Long courseId, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        requireManageCourse(course, user);
        if (course.getStatus() != CourseStatus.ARCHIVED) {
            throw CourseException.badRequest("Курс не в архиве");
        }
        course.setStatus(CourseStatus.ACTIVE);
        courseRepo.save(course);
    }

    @Caching(evict = {
            @CacheEvict(value = "courses",   allEntries = true),
            @CacheEvict(value = "myCourses", allEntries = true),
            @CacheEvict(value = "course",    allEntries = true)
    })
    @Transactional
    public void deleteCourse(Long courseId, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        requireManageCourse(course, user);
        course.setStatus(CourseStatus.DELETED);
        courseRepo.save(course);
    }

    // =========================================================
    //  Участники курса
    // =========================================================

    @Cacheable(value = "courseMembers", key = "#courseId")
    @Transactional(readOnly = true)
    public List<CourseEnrollmentDto> getMembers(Long courseId, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        CourseEnrollment enrollment = enrollmentRepo.findByCourseIdAndUserId(courseId, userId).orElse(null);
        if (!CoursePermissionService.canViewCourse(course, user, enrollment)) {
            throw CourseException.forbidden("Нет доступа к участникам курса");
        }
        return course.getEnrollments().stream()
                .map(this::toEnrollmentDto)
                .collect(Collectors.toList());
    }

    @Caching(evict = {
            @CacheEvict(value = "course",        allEntries = true),
            @CacheEvict(value = "courseMembers", allEntries = true),
            @CacheEvict(value = "myCourses",     allEntries = true),
            @CacheEvict(value = "courses",       allEntries = true)
    })
    @Transactional
    public CourseEnrollmentDto addMember(Long courseId, AddMemberRequest req, Long currentUserId) {
        Course course = requireCourse(courseId);
        User manager = requireUser(currentUserId);
        requireManageCourse(course, manager);

        if (course.getStatus() == CourseStatus.DELETED) {
            throw CourseException.badRequest("Нельзя добавлять участников в удалённый курс");
        }

        User targetUser = requireUser(req.getUserId());
        if (enrollmentRepo.existsByCourseIdAndUserId(courseId, targetUser.getId())) {
            throw CourseException.conflict("Пользователь уже записан на курс");
        }

        String role = normalizeRole(req.getCourseRole());
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setCourse(course);
        enrollment.setUser(targetUser);
        enrollment.setCourseRole(role);
        enrollment = enrollmentRepo.save(enrollment);
        return toEnrollmentDto(enrollment);
    }

    /**
     * Самостоятельная запись на курс (enroll)
     */
    @Caching(evict = {
            @CacheEvict(value = "course",    allEntries = true),
            @CacheEvict(value = "myCourses", allEntries = true),
            @CacheEvict(value = "courses",   allEntries = true)
    })
    @Transactional
    public CourseEnrollmentDto selfEnroll(Long courseId, Long userId) {
        Course course = requireCourse(courseId);
        if (!CoursePermissionService.canSelfEnroll(course)) {
            throw CourseException.forbidden("Самостоятельная запись на курс закрыта");
        }
        if (enrollmentRepo.existsByCourseIdAndUserId(courseId, userId)) {
            throw CourseException.conflict("Вы уже записаны на этот курс");
        }
        User user = requireUser(userId);
        CourseEnrollment enrollment = new CourseEnrollment();
        enrollment.setCourse(course);
        enrollment.setUser(user);
        enrollment.setCourseRole("STUDENT");
        enrollment = enrollmentRepo.save(enrollment);
        return toEnrollmentDto(enrollment);
    }

    @Caching(evict = {
            @CacheEvict(value = "course",        allEntries = true),
            @CacheEvict(value = "courseMembers", allEntries = true),
            @CacheEvict(value = "myCourses",     allEntries = true),
            @CacheEvict(value = "courses",       allEntries = true)
    })
    @Transactional
    public void removeMember(Long courseId, Long targetUserId, Long currentUserId) {
        Course course = requireCourse(courseId);
        User manager = requireUser(currentUserId);

        // Нельзя удалить владельца
        if (course.getOwner().getId().equals(targetUserId)) {
            throw CourseException.forbidden("Нельзя удалить владельца курса");
        }

        // ADMIN или владелец — полное управление
        // Либо пользователь сам выходит из курса
        boolean isSelf = currentUserId.equals(targetUserId);
        if (!isSelf && !CoursePermissionService.canManageCourse(course, manager)) {
            throw CourseException.forbidden("Недостаточно прав для удаления участника");
        }

        if (!enrollmentRepo.existsByCourseIdAndUserId(courseId, targetUserId)) {
            throw CourseException.notFound("Участник");
        }
        enrollmentRepo.deleteByCourseIdAndUserId(courseId, targetUserId);
    }

    /**
     * Самостоятельный выход из курса
     */
    @Caching(evict = {
            @CacheEvict(value = "course",    allEntries = true),
            @CacheEvict(value = "myCourses", allEntries = true),
            @CacheEvict(value = "courses",   allEntries = true)
    })
    @Transactional
    public void selfUnenroll(Long courseId, Long userId) {
        Course course = requireCourse(courseId);
        if (course.getOwner().getId().equals(userId)) {
            throw CourseException.forbidden("Владелец не может покинуть свой курс");
        }
        if (!enrollmentRepo.existsByCourseIdAndUserId(courseId, userId)) {
            throw CourseException.notFound("Запись на курс");
        }
        enrollmentRepo.deleteByCourseIdAndUserId(courseId, userId);
    }

    // =========================================================
    //  Задания / Тестирования
    // =========================================================

    @Cacheable(value = "assignments", key = "#courseId + ':' + #userId")
    @Transactional(readOnly = true)
    public List<AssignmentDto> getAssignments(Long courseId, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        CourseEnrollment enrollment = enrollmentRepo.findByCourseIdAndUserId(courseId, userId).orElse(null);

        if (!CoursePermissionService.canViewCourse(course, user, enrollment)) {
            throw CourseException.forbidden("Нет доступа к заданиям курса");
        }

        boolean canSeeAll = CoursePermissionService.canManageAssignments(course, user, enrollment);
        List<Assignment> assignments = canSeeAll
                ? assignmentRepo.findNotDeletedByCourseId(courseId)
                : assignmentRepo.findByCourseIdAndStatusOrderBySortOrderAscCreatedAtAsc(
                        courseId, AssignmentStatus.ACTIVE);

        return assignments.stream().map(this::toAssignmentDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public AssignmentDto getAssignment(Long courseId, Long assignmentId, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        CourseEnrollment enrollment = enrollmentRepo.findByCourseIdAndUserId(courseId, userId).orElse(null);

        if (!CoursePermissionService.canViewCourse(course, user, enrollment)) {
            throw CourseException.forbidden("Нет доступа к заданию");
        }

        Assignment assignment = assignmentRepo.findByIdAndCourseId(assignmentId, courseId)
                .orElseThrow(() -> CourseException.notFound("Задание"));

        // Студент не видит удалённые/архивные
        boolean canSeeAll = CoursePermissionService.canManageAssignments(course, user, enrollment);
        if (!canSeeAll && assignment.getStatus() != AssignmentStatus.ACTIVE) {
            throw CourseException.notFound("Задание");
        }
        return toAssignmentDto(assignment);
    }

    @Caching(evict = {
            @CacheEvict(value = "assignments", allEntries = true),
            @CacheEvict(value = "course",      allEntries = true)
    })
    @Transactional
    public AssignmentDto createAssignment(Long courseId, CreateAssignmentRequest req, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        CourseEnrollment enrollment = enrollmentRepo.findByCourseIdAndUserId(courseId, userId).orElse(null);

        if (!CoursePermissionService.canManageAssignments(course, user, enrollment)) {
            throw CourseException.forbidden("Только преподаватели могут создавать задания");
        }
        if (course.getStatus() == CourseStatus.DELETED) {
            throw CourseException.badRequest("Нельзя добавлять задания в удалённый курс");
        }

        Assignment a = new Assignment();
        a.setCourse(course);
        a.setTitle(req.getTitle().trim());
        a.setDescription(req.getDescription());
        a.setType(req.getType());
        a.setMaxScore(req.getMaxScore() != null ? req.getMaxScore() : 100);
        a.setDueDate(req.getDueDate());
        a.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0);
        a = assignmentRepo.save(a);
        return toAssignmentDto(a);
    }

    @Caching(evict = {
            @CacheEvict(value = "assignments", allEntries = true),
            @CacheEvict(value = "course",      allEntries = true)
    })
    @Transactional
    public AssignmentDto updateAssignment(Long courseId, Long assignmentId,
                                          UpdateAssignmentRequest req, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        CourseEnrollment enrollment = enrollmentRepo.findByCourseIdAndUserId(courseId, userId).orElse(null);

        if (!CoursePermissionService.canManageAssignments(course, user, enrollment)) {
            throw CourseException.forbidden("Недостаточно прав для редактирования задания");
        }

        Assignment a = assignmentRepo.findByIdAndCourseId(assignmentId, courseId)
                .orElseThrow(() -> CourseException.notFound("Задание"));
        if (a.getStatus() == AssignmentStatus.DELETED) {
            throw CourseException.notFound("Задание");
        }

        if (req.getTitle() != null)       a.setTitle(req.getTitle().trim());
        if (req.getDescription() != null) a.setDescription(req.getDescription());
        if (req.getType() != null)        a.setType(req.getType());
        if (req.getMaxScore() != null)    a.setMaxScore(req.getMaxScore());
        if (req.getDueDate() != null)     a.setDueDate(req.getDueDate());
        if (req.getSortOrder() != null)   a.setSortOrder(req.getSortOrder());

        a = assignmentRepo.save(a);
        return toAssignmentDto(a);
    }

    @Caching(evict = {
            @CacheEvict(value = "assignments", allEntries = true),
            @CacheEvict(value = "course",      allEntries = true)
    })
    @Transactional
    public void archiveAssignment(Long courseId, Long assignmentId, Long userId) {
        Assignment a = requireAssignmentWithCheck(courseId, assignmentId, userId);
        if (a.getStatus() == AssignmentStatus.DELETED) throw CourseException.notFound("Задание");
        a.setStatus(AssignmentStatus.ARCHIVED);
        assignmentRepo.save(a);
    }

    @Caching(evict = {
            @CacheEvict(value = "assignments", allEntries = true),
            @CacheEvict(value = "course",      allEntries = true)
    })
    @Transactional
    public void restoreAssignment(Long courseId, Long assignmentId, Long userId) {
        Assignment a = requireAssignmentWithCheck(courseId, assignmentId, userId);
        if (a.getStatus() != AssignmentStatus.ARCHIVED) throw CourseException.badRequest("Задание не в архиве");
        a.setStatus(AssignmentStatus.ACTIVE);
        assignmentRepo.save(a);
    }

    @Caching(evict = {
            @CacheEvict(value = "assignments", allEntries = true),
            @CacheEvict(value = "course",      allEntries = true)
    })
    @Transactional
    public void deleteAssignment(Long courseId, Long assignmentId, Long userId) {
        Assignment a = requireAssignmentWithCheck(courseId, assignmentId, userId);
        a.setStatus(AssignmentStatus.DELETED);
        assignmentRepo.save(a);
    }

    // =========================================================
    //  Вспомогательные методы
    // =========================================================

    private Assignment requireAssignmentWithCheck(Long courseId, Long assignmentId, Long userId) {
        Course course = requireCourse(courseId);
        User user = requireUser(userId);
        CourseEnrollment enrollment = enrollmentRepo.findByCourseIdAndUserId(courseId, userId).orElse(null);
        if (!CoursePermissionService.canManageAssignments(course, user, enrollment)) {
            throw CourseException.forbidden("Недостаточно прав");
        }
        return assignmentRepo.findByIdAndCourseId(assignmentId, courseId)
                .orElseThrow(() -> CourseException.notFound("Задание"));
    }

    private void requireManageCourse(Course course, User user) {
        if (!CoursePermissionService.canManageCourse(course, user)) {
            throw CourseException.forbidden("Вы не являетесь владельцем курса или администратором");
        }
    }

    private Course requireCourse(Long id) {
        return courseRepo.findById(id)
                .orElseThrow(() -> CourseException.notFound("Курс"));
    }

    private User requireUser(Long id) {
        return userRepo.findById(id)
                .orElseThrow(() -> new CourseException("Пользователь не найден", HttpStatus.NOT_FOUND));
    }

    private String normalizeRole(String role) {
        if (role == null) return "STUDENT";
        return switch (role.toUpperCase()) {
            case "TEACHER" -> "TEACHER";
            case "ADMIN"   -> "ADMIN";
            default        -> "STUDENT";
        };
    }

    // =========================================================
    //  Маппинг в DTO
    // =========================================================

    private CourseSummaryDto toSummary(Course c, Long currentUserId) {
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

        // Определяем роль текущего пользователя
        if (c.getOwner().getId().equals(currentUserId)) {
            dto.setMyRole("OWNER");
        } else {
            c.getEnrollments().stream()
                    .filter(e -> e.getUser().getId().equals(currentUserId))
                    .findFirst()
                    .ifPresent(e -> dto.setMyRole(e.getCourseRole()));
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

        dto.setEnrollments(c.getEnrollments().stream()
                .map(this::toEnrollmentDto)
                .collect(Collectors.toList()));

        dto.setAssignments(c.getAssignments().stream()
                .filter(a -> a.getStatus() != AssignmentStatus.DELETED)
                .map(this::toAssignmentDto)
                .collect(Collectors.toList()));

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

    private AssignmentDto toAssignmentDto(Assignment a) {
        AssignmentDto dto = new AssignmentDto();
        dto.setId(a.getId());
        dto.setCourseId(a.getCourse().getId());
        dto.setTitle(a.getTitle());
        dto.setDescription(a.getDescription());
        dto.setType(a.getType());
        dto.setStatus(a.getStatus());
        dto.setMaxScore(a.getMaxScore());
        dto.setDueDate(a.getDueDate());
        dto.setSortOrder(a.getSortOrder());
        dto.setCreatedAt(a.getCreatedAt());
        dto.setUpdatedAt(a.getUpdatedAt());
        return dto;
    }
}