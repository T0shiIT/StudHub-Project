#include <string>
#include <iostream>

#include "new_user.h"
#include "crow.h"
#include <nlohmann/json.hpp>
#include <pqxx/pqxx>

using json = nlohmann::json;

extern std::string DB_CONN;

namespace handlers {

    void get_user_profile_handler(crow::SimpleApp& app) {
        CROW_ROUTE(app, "/api/cpp/profile/<int>")
        ([](int userid) {
            try {
                pqxx::connection C(DB_CONN);
                pqxx::read_transaction TR(C);

                pqxx::result r = TR.exec_params(
                    "SELECT u.email, u.first_name, u.last_name, u.group_name, p.bio, p.avatar_url "
                    "FROM app_users u "
                    "LEFT JOIN user_profile p ON u.user_id = p.user_id "
                    "WHERE u.user_id = $1", userid);

                    if (r.empty()) {
                        return crow::response(404, "User not found");
                    }

                    auto row = r[0];
                    json res;
                    res["email"] = row["email"].as<std::string>();
                    res["first_name"] = row["first_name"].is_null() ? "" : row["first_name"].as<std::string>();
                    res["last_name"] = row["last_name"].is_null() ? "" : row["last_name"].as<std::string>();
                    res["group_name"] = row["group_name"].is_null() ? "no group" : row["group_name"].as<std::string>();
                    res["bio"] = row["bio"].is_null() ? "" : row["bio"].as<std::string>();
                    res["avatar_url"] = row["avatar_url"].is_null() ? "" : row["avatar_url"].as<std::string>();

                    crow::response response(res.dump());
                    response.set_header("Content-Type", "application/json");
                    return response;
            } catch (const std::exception& e) {
                return crow::response(500, e.what());
            }
        });
    }



}