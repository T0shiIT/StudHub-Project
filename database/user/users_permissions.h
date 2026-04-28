#pragma once
#include <string>
#include <vector>
#include <set>

namespace user_permissions {

    class User {
    public:
        int id;
        std::string email;
        std::string full_name;
        bool is_blocked = false;
        std::set<std::string> permissions;

        virtual ~User() = default;
        // проверка на наличие прав
        bool has_permission(const std::string& perm) const {
            if (is_blocked) return false;
            return permissions.find(perm) != permissions.end();
        }
        //Пррисоединиться к курсу
        bool has_permission_to_add_course() const { return has_permission("course:join"); }



        // ПОЛЬЗОВАТЕЛИ
        bool can_view_user_list() const { return has_permission("user:lis:read"); }

        //ВНУТРЕННЯЯ НАСТРЙОКА ПОЛЬЗОВАТЕЛЯ (КАСТОМ ЮЗЕРА)
        bool can_edit_profile() { return has_permission("profile:view"); }


    };
    
    class Admin : public User {
    public:    
        Admin() {
            permissions = {
                "course:join",
                "profile:view",
                "profile:edit"
            };
        }
        
    };

    class Guest : public User {
    public:
        Guest() {
            permissions = {
                "course:join",
                "porfile:view",
                "profile:edit"
            };
        }
    };

    class Student : public User {
    public:
        Student() {
            permissions = {
                "course:join",
                "profile:view",
                "profile:edit"
            };
        }
    };




}