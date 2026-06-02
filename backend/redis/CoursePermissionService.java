package com.studhub.course;

import com.studhub.user.User;

/**
 * Утилита для проверки разрешений пользователя относительно курса.
 * <p>
 * Матрица прав:
 * <pre>
 * Действие                  | ADMIN | Owner(TEACHER) | Enrolled TEACHER | STUDENT | Не участник
 * --------------------------|-------|---------------|-----------------|---------|------------
 * Создание курса            |  ✓    |      ✓        |        ✗        |    ✗    |     ✗
 * Просмотр активного курса  |  ✓    |      ✓        |        ✓        |    ✓    |     ✓ (если visible)
 * Просмотр архива           |  ✓    |      ✓        |        ✓        |    ✓    |     ✗
 * Редактировать/архив/удал. |  ✓    |      ✓        |        ✗        |    ✗    |     ✗
 * Добавлять/удалять участн. |  ✓    |      ✓        |        ✗        |    ✗    |     ✗
 * Создавать/ред. задания    |  ✓    |      ✓        |        ✓        |    ✗    |     ✗
 * Просматривать задания     |  ✓    |      ✓        |        ✓        |    ✓    |     ✗
 * </pre>
 */
public class CoursePermissionService {

    private CoursePermissionService() {}

    /** Глобальный ADMIN */
    public static boolean isGlobalAdmin(User user) {
        return "ADMIN".equalsIgnoreCase(user.getRole());
    }

    /** Владелец курса */
    public static boolean isOwner(Course course, User user) {
        return course.getOwner().getId().equals(user.getId());
    }

    /** Имеет право управлять курсом (создатель или глобальный ADMIN) */
    public static boolean canManageCourse(Course course, User user) {
        return isGlobalAdmin(user) || isOwner(course, user);
    }

    /**
     * Может добавлять/удалять задания:
     * — владелец, глобальный ADMIN или учитель курса (enrolled с ролью TEACHER)
     */
    public static boolean canManageAssignments(Course course, User user,
                                               CourseEnrollment enrollment) {
        if (canManageCourse(course, user)) return true;
        return enrollment != null && "TEACHER".equalsIgnoreCase(enrollment.getCourseRole());
    }

    /** Может просматривать содержимое курса (записан на курс или имеет управление) */
    public static boolean canViewCourse(Course course, User user,
                                        CourseEnrollment enrollment) {
        if (canManageCourse(course, user)) return true;
        if (enrollment != null) return true;
        // Публичный активный видимый курс может видеть любой аутентифицированный пользователь
        return course.getStatus() == CourseStatus.ACTIVE && course.isVisible();
    }

    /**
     * Может записываться на курс (самостоятельно):
     * только если enrollmentOpen и курс активен
     */
    public static boolean canSelfEnroll(Course course) {
        return course.getStatus() == CourseStatus.ACTIVE && course.isEnrollmentOpen();
    }
}