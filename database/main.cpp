#include <iostream>
#include <pqxx/pqxx>
#include <crow.h>
#include <string>

#include "handlers/new_user.h"
#include "handlers/get_data.h"
#include "handlers/schedule_json.h"
#include "user/users_permissions.h"

//#include "handlers/upload_schedule.h"
std::string DB_CONN = "host=db dbname=studhub user=user password=pass";

int main() {
    crow::SimpleApp app; 
    handlers::register_new_user_handler(app);
    handlers::register_oauth_user_handler(app);
    handlers::get_user_profile_handler(app);
    handlers::register_schedule_json_handlers(app);
    // handlers::upload_schedule_handler(app);


    app.port(8081).multithreaded().run();
    return 0;
}

//проверка контакта что код может парсить java
/*
docker exec -it studhub-project-cpp-1 bash
curl -X POST http://localhost:8081/api/cpp/sync-user -H "Content-Type: application/json" -d '{"id": "yandex_777", "default_email": "boss@yandex.ru"}'
*/