#include "get_data.h"
#include "db_utils.h" 
#include <crow.h>
#include <nlohmann/json.hpp>
#include <pqxx/pqxx>

using json = nlohmann::json;
extern std::string DB_CONN;

namespace handlers {

    void get_user_profile_handler(crow::SimpleApp& app) {
        CROW_ROUTE(app, "/api/cpp/profile/<int>")
        ([](const crow::request& req, int target_user_id) {
            try {
                std::string requester_id_str = req.get_header_value("X-User-Id");
                if (requester_id_str.empty()) return crow::response(401, "Missing X-User-Id header");
                int requester_id = std::stoi(requester_id_str);

                auto user = load_user(requester_id);
                if (!user) return crow::response(401, "Unknown user");
                if (user->is_blocked) return crow::response(403, "User is blocked");
                if (!user->can_view_profile()) return crow::response(403, "Insufficient permissions");

                auto conn = ConnectionPool::instance().acquire();
                pqxx::read_transaction TR(*conn);
                pqxx::result r = TR.exec_params(
                    "SELECT u.email, u.first_name, u.last_name, u.group_name, "
                    "p.bio, p.avatar_url "
                    "FROM app_users u "
                    "LEFT JOIN user_profile p ON u.user_id = p.user_id "
                    "WHERE u.user_id = $1", target_user_id);

                if (r.empty()) return crow::response(404, "User not found");

                auto row = r[0];
                json res;
                res["email"]      = row["email"].as<std::string>();
                res["first_name"] = row["first_name"].is_null() ? "" : row["first_name"].as<std::string>();
                res["last_name"]  = row["last_name"].is_null() ? "" : row["last_name"].as<std::string>();
                res["group_name"] = row["group_name"].is_null() ? "no group" : row["group_name"].as<std::string>();
                res["bio"]        = row["bio"].is_null() ? "" : row["bio"].as<std::string>();
                res["avatar_url"] = row["avatar_url"].is_null() ? "" : row["avatar_url"].as<std::string>();

                crow::response resp(res.dump());
                resp.set_header("Content-Type", "application/json");
                return resp;
            } catch (const std::exception& e) {
                return crow::response(500, e.what());
            }
        });
    }

}