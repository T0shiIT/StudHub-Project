#include <iostream>

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
            try {
                user_id = std::stoi(read_id_str);
            } catch (...) {
                return crow::response(400, "Invalid User ID format");
            }

            auto data = json::parse(req.body);
            std::string target_role = data.value("role", "GUEST");

            try {
                pqxx::connection C(DB_CONN);
                pqxx::work W(C);

                auto r = W.exec_params("SELECT role FROM app_users WHERE user_id = $1", user_id);
                std::string old_role = r[0][0].as<std::string>();

                W.exec_params("UPDATE app_users SET role = $1 WHERE user_id = $2", target_role, user_id);
                W.commit();

                std::cout << "[DEBUG] Role for user " << user_id << " changed: " << old_role << " -> " << target_role << std::endl;
                return crow::response(200, "Role updated");

            } catch (...) { return crow::response(500, "DB Error"); }
        });
    }

}
   