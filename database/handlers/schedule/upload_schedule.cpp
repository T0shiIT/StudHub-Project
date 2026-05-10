// #include "upload_schedule.h"
// #include "db_utils.h"
// #include <crow.h>
// #include <nlohmann/json.hpp>
// #include <pqxx/pqxx>
// #include <xlnt/xlnt.hpp>
// #include <sstream>
// #include <vector>

// using json = nlohmann::json;
// extern std::string DB_CONN;

// namespace handlers {

// void upload_schedule_handler(crow::SimpleApp& app) {
//     CROW_ROUTE(app, "/api/cpp/upload-schedule").methods(crow::HTTPMethod::POST)
//     ([](const crow::request& req) {
//         try {
//             // --- 1. Проверка прав (только ADMIN) ---
//             std::string user_id_str = req.get_header_value("X-User-Id");
//             if (user_id_str.empty())
//                 return crow::response(401, "Missing X-User-Id");

//             int user_id = std::stoi(user_id_str);
//             auto user = load_user(user_id);
//             if (!user || user->is_blocked || user->role != "ADMIN")
//                 return crow::response(403, "Only admin can upload schedule");

//             // --- 2. Разбор multipart-запроса ---
//             // Crow автоматически парсит multipart/form-data
//             auto& body = req.body;
//             // Ищем границу multipart (у Crow есть встроенная поддержка)
//             crow::multipart::message msg(req);
//             // Получаем все части
//             for (const auto& part : msg.parts) {
//                 if (part.headers.find("Content-Disposition") != part.headers.end()) {
//                     auto disp = part.headers.at("Content-Disposition");
//                     // Ищем filename
//                     if (disp.find("filename=\"") != std::string::npos) {
//                         // Это файловая часть
//                         const auto& file_data = part.body;

//                         // --- 3. Парсинг Excel с помощью xlnt ---
//                         xlnt::workbook wb;
//                         std::istringstream file_stream(file_data);
//                         wb.load(file_stream);
//                         auto ws = wb.active_sheet();

//                         pqxx::connection C(DB_CONN);
//                         pqxx::work W(C);

//                         // Предполагаем структуру столбцов:
//                         // A: Группа, B: День недели, C: Начало, D: Конец,
//                         // E: Предмет, F: Преподаватель, G: Аудитория
//                         // Первая строка – заголовки, пропускаем (row 1).
//                         for (auto row : ws.rows()) {
//                             // Пропускаем заголовок (можно проверить по номеру строки)
//                             if (row.front().row() == 1) continue;

//                             std::string group    = row[0].to_string();
//                             std::string day      = row[1].to_string();
//                             std::string start    = row[2].to_string();
//                             std::string end      = row[3].to_string();
//                             std::string subject  = row[4].to_string();
//                             std::string teacher  = row[5].to_string();
//                             std::string room     = row[6].to_string();

//                             // Простейшая валидация
//                             if (group.empty() || day.empty() || start.empty() ||
//                                 end.empty() || subject.empty()) continue;

//                             // Вставка в БД
//                             W.exec_params(
//                                 "INSERT INTO schedule_items "
//                                 "(group_name, day_of_week, start_time, end_time, subject, teacher, room, uploaded_by) "
//                                 "VALUES ($1, $2, $3::time, $4::time, $5, $6, $7, $8)",
//                                 group, day, start, end, subject, teacher, room, user_id
//                             );
//                         }

//                         W.commit();
//                         json resp;
//                         resp["status"] = "ok";
//                         resp["message"] = "Schedule uploaded successfully";
//                         return crow::response(200, resp.dump());
//                     }
//                 }
//             }
//             return crow::response(400, "No file found in request");
//         } catch (const std::exception& e) {
//             return crow::response(500, std::string("Error: ") + e.what());
//         }
//     });
// }

// }