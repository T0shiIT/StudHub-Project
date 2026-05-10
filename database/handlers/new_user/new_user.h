#pragma once
#include "crow.h"

namespace handlers {
    void register_new_user_handler(crow::SimpleApp& app);
    void register_oauth_user_handler(crow::SimpleApp& app);
}
