package com.studhub.course;

import com.studhub.user.User;

public class CoursePermissionService {

    public static boolean canManageCourse(Course course, User user) {
        return "ADMIN".equalsIgnoreCase(user.getRole()) || course.getOwner().getId().equals(user.getId());
    }

    public static boolean canViewCourse(Course course, User user, CourseEnrollment enrollment) {
        if (canManageCourse(course, user)) return true;
        if (enrollment != null) return true;
        return course.getStatus() == CourseStatus.ACTIVE && course.isVisible();
    }

    public static boolean canSelfEnroll(Course course) {
        return course.getStatus() == CourseStatus.ACTIVE && course.isEnrollmentOpen();
    }
}