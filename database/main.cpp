#include <iostream>
#include "user/users_permissions.h"
#include <pqxx/pqxx>
#include <crow.h>
#include <string>

extern const std::string DB_CONN = "host=postgres-db dbname=TestAppLogic user=postgres password=postgres";


int main() {
    crow::SimpleApp app;    

    app.port(8081).multithreaded().run();
    /*
    Вся реализация
    */
    return 0;


}