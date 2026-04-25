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
            return permissions.find(perm) != permissions.end();
        }

        // ПОЛЬЗОВАТЕЛИ
        bool can_view_user_list() const { return has_permission("user:lis:read"); }


    };
    
    class Admin : public User {
    public:    
        Admin() {
            permissions = {

            };
        }
        
    };



}