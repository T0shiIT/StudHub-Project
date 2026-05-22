#include <iostream>
#include <set>
#include "user_set_role.h"
#include "../db_utils.h"
#include <crow.h>
#include <nlohmann/json.hpp>
#include <pqxx/pqxx>

using json = nlohmann::json;
extern std::string DB_CONN;

namespace handlers {

    void set_role(crow::SimpleApp& app) {
        CROW_ROUTE(app, "/api/cpp/test_handler/change_role").methods(crow::HTTPMethod::POST)
        ([](const crow::request& req) {

            std::string read_id_str = req.get_header_value("X-User-Id");
            if (read_id_str.empty()) return crow::response(401, "Unauthorized");

            int user_id;
            try { user_id = std::stoi(read_id_str); } 
            catch (...) { return crow::response(400, "Invalid User ID format"); }

            auto requester = load_user(user_id);
            if (!requester) return crow::response(401, "Unknown user");
            if (requester->is_blocked) return crow::response(403, "User is blocked");
            if (!requester->has_permission(user_permissions::Perm::USER_MANAGE)) {
                return crow::response(403, "Only administrators can change roles");
            }

            auto data = json::parse(req.body);
            std::string target_role = data.value("role", "STUDENT");

            static const std::set<std::string> ALLOWED_ROLES = {"STUDENT", "TEACHER", "ADMIN"};
            if (ALLOWED_ROLES.find(target_role) == ALLOWED_ROLES.end()) {
                return crow::response(400, "Invalid role. Allowed: STUDENT, TEACHER, ADMIN");
            }

            try {
                auto conn = ConnectionPool::instance().acquire();
                pqxx::work W(*conn);

                auto r = W.exec_params("SELECT role FROM app_users WHERE user_id = $1", user_id);
                if (r.empty()) return crow::response(404, "User not found");

                std::string old_role = r[0][0].as<std::string>();
                W.exec_params("UPDATE app_users SET role = $1 WHERE user_id = $2", target_role, user_id);
                W.commit();

                std::cout << "[DEBUG] Role for user " << user_id << " changed: " << old_role << " -> " << target_role << std::endl;
                return crow::response(200, "Role updated");
            } catch (...) {
                return crow::response(500, "DB Error");
            }
        });
    }
}