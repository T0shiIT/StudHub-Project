#pragma once
#include <string>
#include <set>
#include <memory>
#include <stdexcept>

#include "../roles/roles.h"

namespace user_permissions {
    namespace Perm {
        const std::string COURSE_JOIN     = "course:join";
        const std::string PROFILE_VIEW    = "profile:view";
        const std::string PROFILE_EDIT    = "profile:edit";
        const std::string USER_LIST_READ  = "user:list:read";
        const std::string GRADE_EDIT      = "grade:edit";
        const std::string SCHEDULE_UPLOAD = "schedule:upload";
        const std::string USER_MANAGE     = "user:manage";
    }

    class User {
    public:
        int id;
        std::string email;
        std::string full_name;
        bool is_blocked = false;
        std::set<std::string> permissions;

        virtual ~User() = default;

        bool has_permission(const std::string& perm) const {
            if (is_blocked) return false;
            return permissions.find(perm) != permissions.end();
        }

        bool can_join_course()    const { return has_permission(Perm::COURSE_JOIN); }
        bool can_view_profile()   const { return has_permission(Perm::PROFILE_VIEW); }
        bool can_edit_profile()   const { return has_permission(Perm::PROFILE_EDIT); }
        bool can_view_user_list() const { return has_permission(Perm::USER_LIST_READ); }
        bool can_edit_grades()    const { return has_permission(Perm::GRADE_EDIT); }
    };

    // ------------------ Конкретные роли ------------------

    class Admin : public User {
    public:
        Admin() {
            permissions = { Perm::COURSE_JOIN, Perm::PROFILE_VIEW, Perm::PROFILE_EDIT,
                            Perm::USER_LIST_READ, Perm::GRADE_EDIT,
                            Perm::SCHEDULE_UPLOAD, Perm::USER_MANAGE };
        }
    };

    class Teacher : public User {
    public:
        Teacher() {
            permissions = { Perm::COURSE_JOIN, Perm::PROFILE_VIEW, Perm::PROFILE_EDIT,
                            Perm::USER_LIST_READ, Perm::GRADE_EDIT };
        }
    };

    class Student : public User {
    public:
        Student() {
            permissions = { Perm::COURSE_JOIN, Perm::PROFILE_VIEW, Perm::PROFILE_EDIT };
        }
    };

    inline std::unique_ptr<User> create_user(Role role) {
        switch(role) {
            case Role::STUDENT:
                return std::make_unique<Student>();

            case Role::TEACHER:
                return std::make_unique<Teacher>();

            case Role::ADMIN:
                return std::make_unique<Admin>();

            default:
                throw std::invalid_argument("Unknown role");
        }
    }

    //временный коммент
    // inline std::unique_ptr<User> create_user(Role role) {
    //     if (role == "ADMIN")   return std::make_unique<Admin>();
    //     if (role == "TEACHER") return std::make_unique<Teacher>();
    //     if (role == "STUDENT") return std::make_unique<Student>();
    //     throw std::invalid_argument("Unknown role: " + role);
    // }
}