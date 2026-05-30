#include <string>

#include "new_user.h"
#include "crow.h"
#include <nlohmann/json.hpp>
#include <pqxx/pqxx>

#include "../db_utils.h"
#include "../roles/roles.h"

using json = nlohmann::json;
extern std::string DB_CONN;

namespace {
    crow::response make_json_response(int code, const json& payload) {
        crow::response res(code, payload.dump());
        res.set_header("Content-Type", "application/json");
        return res;
    }
}

namespace handlers {

    void register_new_user_handler(crow::SimpleApp& app) {
        CROW_ROUTE(app, "/api/cpp/register-user").methods(crow::HTTPMethod::POST)
        ([](const crow::request& req) {
            try {
                std::cout << "DEBUG [DB] RECEIVED BODY: " << req.body << std::endl;
                auto data = json::parse(req.body);

                std::string email        = data.value("email", "");
                std::string login        = data.value("login", "");
                std::string passwordHash = data.value("password_hash", "");
                std::string firstName    = data.value("first_name", "");
                std::string lastName     = data.value("last_name", "");
                std::string groupName    = data.value("group_name", "");

                if (email.empty() || login.empty() || passwordHash.empty()
                    || firstName.empty() || lastName.empty() || groupName.empty()) {
                    return make_json_response(400, json{{"error", "Missing required fields"}});
                }

                auto conn = ConnectionPool::instance().acquire();
                if (!conn->is_open()) return make_json_response(500, json{{"error", "DB connection failed"}});

                pqxx::work W(*conn);

                pqxx::result existing = W.exec_params(
                    "SELECT 1 FROM app_users WHERE email = $1 OR login = $2", email, login);
                if (!existing.empty()) return make_json_response(409, json{{"error", "User already exists"}});

                pqxx::result inserted = W.exec_params(
                    "INSERT INTO app_users "
                    "(email, login, password_hash, first_name, last_name, group_name, role, created_at) "
                    "VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING user_id",
                    email, login, passwordHash, firstName, lastName, groupName, static_cast<int>(Role::STUDENT) ); //изменена роль

                long userid = inserted[0][0].as<long>();
                W.commit();

                std::cout << "DEBUG [DB] Registered user " << email << " (id=" << userid << ")" << std::endl;

                json res;
                res["status"] = "ok"; res["id"] = userid; res["email"] = email;
                res["login"] = login; res["first_name"] = firstName;
                res["last_name"] = lastName; res["group_name"] = groupName;
                return make_json_response(201, res);
            }
            catch (const pqxx::unique_violation& e) {
                return make_json_response(409, json{{"error", "User already exists"}});
            }
            catch (const std::exception& e) {
                std::cerr << "ERROR [DB] register-user: " << e.what() << std::endl;
                return make_json_response(400, json{{"error", std::string("Bad request: ") + e.what()}});
            }
        });
    }

    void register_oauth_user_handler(crow::SimpleApp& app) {
        CROW_ROUTE(app, "/api/cpp/sync-oauth-user").methods(crow::HTTPMethod::POST)
        ([](const crow::request& req) {
            try {
                std::cout << "DEBUG [DB] /api/cpp/sync-oauth-user body: " << req.body << std::endl;
                auto data = json::parse(req.body);

                std::string email        = data.value("email", "");
                std::string login        = data.value("login", "");
                std::string passwordHash = data.value("password_hash", "oauth:external");
                std::string firstName    = data.value("first_name", "");
                std::string lastName     = data.value("last_name", "");
                std::string groupName    = data.value("group_name", "—");

                if (email.empty() || login.empty()) return make_json_response(400, json{{"error", "email and login are required"}});
                if (firstName.empty()) firstName = "—";
                if (lastName.empty())  lastName  = "—";

                auto conn = ConnectionPool::instance().acquire();
                if (!conn->is_open()) return make_json_response(500, json{{"error", "DB connection failed"}});

                pqxx::work W(*conn);

                pqxx::result row = W.exec_params(
                    "INSERT INTO app_users "
                    "(email, login, password_hash, first_name, last_name, group_name, role, created_at) "
                    "VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) "
                    "ON CONFLICT (email) DO UPDATE SET "
                    "  login = EXCLUDED.login, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name "
                    "RETURNING user_id, role",
                    email, login, passwordHash, firstName, lastName, groupName, static_cast<int>(Role::STUDENT)); //вместо string роли -> int

                long userid = row[0][0].as<long>();
                int currentRole = row[0][1].as<int>(); //тоже поменял роль с стринга на инт
                W.commit();

                std::cout << "DEBUG [DB] Synced OAuth user " << email << " (id=" << userid << ")" << std::endl;

                json res;
                res["status"] = "ok"; res["id"] = userid; res["role"] = role_to_string(static_cast<Role>(currentRole)); 
                res["email"] = email; res["login"] = login; 
                res["first_name"] = firstName; res["last_name"] = lastName;
                return make_json_response(200, res);
            }
            catch (const std::exception& e) {
                std::cerr << "ERROR [DB] sync-oauth-user: " << e.what() << std::endl;
                return make_json_response(400, json{{"error", std::string("Bad request: ") + e.what()}});
            }
        });
    }
}