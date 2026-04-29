#pragma once
#include <memory>
#include <string>
#include <pqxx/pqxx>
#include "users_permissions.h"

extern std::string DB_CONN;

inline std::unique_ptr<user_permissions::User> load_user(int user_id) {
    pqxx::connection C(DB_CONN);
    pqxx::read_transaction T(C);
    pqxx::result r = T.exec_params(
        "SELECT role, is_blocked, email, first_name, last_name "
        "FROM app_users WHERE user_id = $1", user_id);
    if (r.empty()) return nullptr;

    auto row = r[0];
    std::string role = row["role"].as<std::string>();
    bool blocked = row["is_blocked"].as<bool>();

    auto user = user_permissions::create_user(role);
    user->id = user_id;
    user->is_blocked = blocked;
    user->email = row["email"].as<std::string>();
    user->full_name = row["first_name"].as<std::string>()
                    + " " + row["last_name"].as<std::string>();
    return user;
}