#include "schedule_json.h"
#include <nlohmann/json.hpp>
#include <pqxx/pqxx>
#include <filesystem>
#include <fstream>
#include <chrono>
#include <string>

#include "../user/users_permissions.h"
#include "../db_utils.h"

using json = nlohmann::json;
extern std::string DB_CONN;

namespace {
    constexpr const char* SCHEDULE_FILES_DIR = "/app/uploads/schedules";

    crow::response json_response(int code, const json& body) {
        crow::response res(code, body.dump());
        res.set_header("Content-Type", "application/json");
        return res;
    }

    std::string sanitize_file_name(const std::string& input) {
        std::string out;
        out.reserve(input.size());
        for (char c : input) {
            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
                (c >= '0' && c <= '9') || c == '.' || c == '_' || c == '-') {
                out.push_back(c);
            } else {
                out.push_back('_');
            }
        }
        return out.empty() ? "schedule.xlsx" : out;
    }

    std::string save_schedule_json_file(const std::string& originalFileName, const std::string& jsonContent) {
        namespace fs = std::filesystem;
        fs::create_directories(SCHEDULE_FILES_DIR);

        auto now = std::chrono::system_clock::now();
        auto ts = std::chrono::duration_cast<std::chrono::seconds>(now.time_since_epoch()).count();
        std::string safeName = sanitize_file_name(originalFileName);
        std::string finalName = std::to_string(ts) + "_" + safeName + ".json";
        fs::path filePath = fs::path(SCHEDULE_FILES_DIR) / finalName;

        std::ofstream file(filePath, std::ios::binary);
        if (!file.is_open()) throw std::runtime_error("Unable to open file for schedule JSON writing");
        file << jsonContent;
        file.close();
        return finalName;
    }
}

namespace handlers {

void register_schedule_json_handlers(crow::SimpleApp& app) {
    // Загрузка расписания (только ADMIN)
    CROW_ROUTE(app, "/api/cpp/schedule/upload-json").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req) {
        try {
            std::string user_id_str = req.get_header_value("X-User-Id");
            if (user_id_str.empty()) return json_response(401, json{{"error", "Missing X-User-Id header"}});
            
            int user_id = std::stoi(user_id_str);
            auto user = load_user(user_id);
            if (!user) return json_response(401, json{{"error", "Unknown user"}});
            if (user->is_blocked) return json_response(403, json{{"error", "User is blocked"}});
            if (!user->has_permission(user_permissions::Perm::SCHEDULE_UPLOAD)) {
                return json_response(403, json{{"error", "Insufficient permissions"}});
            }

            auto payload = json::parse(req.body);
            const std::string fileName = payload.value("file_name", "");
            const std::string fileType = payload.value("file_type", "");
            const std::string uploadedBy = payload.value("uploaded_by", "");

            if (fileName.empty() || fileType.empty() || uploadedBy.empty() || !payload.contains("schedule_json")) {
                return json_response(400, json{{"error", "Missing required fields"}});
            }

            const std::string scheduleJson = payload["schedule_json"].dump();

            auto conn = ConnectionPool::instance().acquire();
            if (!conn->is_open()) return json_response(500, json{{"error", "DB connection failed"}});

            pqxx::work W(*conn);
            // DDL (CREATE TABLE / ALTER TABLE) удален. Таблица должна существовать в БД.
            
            pqxx::result inserted = W.exec_params(
                "INSERT INTO schedule_uploads (file_name, file_type, schedule_json, uploaded_by) "
                "VALUES ($1, $2, $3::jsonb, $4) RETURNING id, created_at",
                fileName, fileType, scheduleJson, uploadedBy
            );
            W.commit();
            
            std::string savedJsonFile = save_schedule_json_file(fileName, scheduleJson);

            json res;
            res["status"] = "ok";
            res["id"] = inserted[0]["id"].as<long>();
            res["fileName"] = fileName;
            res["createdAt"] = inserted[0]["created_at"].c_str();
            res["jsonFile"] = savedJsonFile;
            return json_response(200, res);
        } catch (const std::exception& e) {
            return json_response(500, json{{"error", std::string("Schedule save failed: ") + e.what()}});
        }
    });

    // Получение последнего расписания (любой авторизованный)
    CROW_ROUTE(app, "/api/cpp/schedule/latest").methods(crow::HTTPMethod::GET)
    ([](const crow::request& req) {
        try {
            std::string user_id_str = req.get_header_value("X-User-Id");
            if (user_id_str.empty()) return json_response(401, json{{"error", "Missing X-User-Id header"}});
            
            int user_id = std::stoi(user_id_str);
            auto user = load_user(user_id);
            if (!user) return json_response(401, json{{"error", "Unknown user"}});
            if (user->is_blocked) return json_response(403, json{{"error", "User is blocked"}});
            if (!user->can_view_profile()) return json_response(403, json{{"error", "Insufficient permissions"}});

            auto conn = ConnectionPool::instance().acquire();
            pqxx::read_transaction T(*conn);
            pqxx::result r = T.exec(
                "SELECT id, file_name, file_type, schedule_json::text, uploaded_by, created_at "
                "FROM schedule_uploads ORDER BY created_at DESC LIMIT 1"
            );

            if (r.empty()) return json_response(200, json{{"message", "Расписание еще не загружено"}});

            auto row = r[0];
            json res;
            res["id"] = row["id"].as<long>();
            res["fileName"] = row["file_name"].as<std::string>();
            res["fileType"] = row["file_type"].as<std::string>();
            res["uploadedBy"] = row["uploaded_by"].as<std::string>();
            res["createdAt"] = row["created_at"].c_str();
            res["schedule"] = json::parse(row["schedule_json"].as<std::string>());
            return json_response(200, res);
        } catch (const std::exception& e) {
            return json_response(500, json{{"error", std::string("Schedule load failed: ") + e.what()}});
        }
    });
}

}