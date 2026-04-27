#include <string>
#include <iostream>

#include "new_user.h"
#include "crow.h"
#include <nlohmann/json.hpp>
#include <pqxx/pqxx>

using json = nlohmann::json;

extern std::string DB_CONN;

namespace handlers {
    void register_new_user_handler(crow::SimpleApp& app) {
    CROW_ROUTE(app, "/api/cpp/sync-user").methods(crow::HTTPMethod::POST) 
    ([](const crow::request& req) {
            try {
                std::cout << "[DEBUG] RECEIVED BODY: " << req.body << std::endl;
                auto data = json::parse(req.body); //парсим полученные данные

                std::string yandexID = data.value("id", "");
                std::string email = data.value("default_email", "unknown");
                std::string fullName = data.value("display_name", email);

                if (yandexID.empty()) {
                    return crow::response(400, "Error, No Uandex ID provided");
                } 
                else {

                    pqxx::connection C(DB_CONN);
                    if (C.is_open()) {
                        pqxx::work W(C);

                        std::string sql =   "INSERT INTO users (email, full_name) VALUES (" +
                                          W.quote(email) + ", " + 
                                          W.quote(fullName) + ") " +
                                          "ON CONFLICT (email) DO NOTHING;";

                        W.exec(sql);
                        W.commit();
                        std::cout << "[DB] User: " << email << " saved/verified in database." << std::endl;
                    }

                    json res;
                    res["status"] = "ok";
                    res["internal_id"] = email;
                    return crow::response(200, res.dump()); //возврат ответа
                }
            }
            catch (const std::exception& e) {
                return crow::response(400, "JSON Parse Error");
            }
        });
    }
}

