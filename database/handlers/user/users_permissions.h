#pragma once
#include <string>
#include <set>
#include <memory>
#include <stdexcept>

namespace user_permissions {
    namespace Perm {
        const std::string COURSE_JOIN     = "course:join";
        const std::string PROFILE_VIEW    = "profile:view";
        const std::string PROFILE_EDIT    = "profile:edit";
        const std::string USER_LIST_READ  = "user:list:read";
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

        bool can_join_course() const    { return has_permission(Perm::COURSE_JOIN); }
        bool can_view_profile() const   { return has_permission(Perm::PROFILE_VIEW); }
        bool can_edit_profile() const   { return has_permission(Perm::PROFILE_EDIT); }
        bool can_view_user_list() const { return has_permission(Perm::USER_LIST_READ); }
    };

    class Admin : public User {
    public:
        Admin() {
            permissions = { Perm::COURSE_JOIN, Perm::PROFILE_VIEW,
                            Perm::PROFILE_EDIT, Perm::USER_LIST_READ };
        }
    };

    class Guest : public User {
    public:
        Guest() {
            permissions = { Perm::COURSE_JOIN, Perm::PROFILE_VIEW,
                            Perm::PROFILE_EDIT };
        }
    };

    class Student : public User {
    public:
        Student() {
            permissions = { Perm::COURSE_JOIN, Perm::PROFILE_VIEW,
                            Perm::PROFILE_EDIT };
        }
    };

    inline std::unique_ptr<User> create_user(const std::string& role) {
        if (role == "ADMIN")   return std::make_unique<Admin>();
        if (role == "STUDENT") return std::make_unique<Student>();
        if (role == "GUEST")   return std::make_unique<Guest>();
        throw std::invalid_argument("Unknown role: " + role);
    }
}