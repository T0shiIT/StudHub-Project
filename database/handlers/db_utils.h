#pragma once
#include <memory>
#include <string>
#include <pqxx/pqxx>
#include <queue>
#include <mutex>
#include <condition_variable>
#include <exception>

#include "users_permissions.h"

extern std::string DB_CONN;

class ConnectionPool {
public:
    static ConnectionPool& instance() {
        static ConnectionPool pool(20); // Максимум 20 соединений в пуле
        return pool;
    }

    // RAII обертка для автоматического возврата соединения в пул
    class ConnectionWrapper {
    public:
        ConnectionWrapper(std::shared_ptr<pqxx::connection> conn, ConnectionPool& pool)
            : conn_(conn), pool_(pool) {}
        
        ~ConnectionWrapper() {
            // Если происходит раскрутка стека из-за исключения (транзакция упала),
            // соединение может быть в "сломанном" состоянии. Уничтожаем его.
            if (std::uncaught_exceptions() > 0) {
                pool_.discard(conn_);
            } else {
                pool_.release(conn_);
            }
        }
        
        // Запрещаем копирование, разрешаем перемещение
        ConnectionWrapper(const ConnectionWrapper&) = delete;
        ConnectionWrapper& operator=(const ConnectionWrapper&) = delete;
        ConnectionWrapper(ConnectionWrapper&&) = default;
        ConnectionWrapper& operator=(ConnectionWrapper&&) = default;

        pqxx::connection* operator->() const { return conn_.get(); }
        pqxx::connection& operator*() const { return *conn_; }
        
    private:
        std::shared_ptr<pqxx::connection> conn_;
        ConnectionPool& pool_;
    };

    ConnectionWrapper acquire() {
        std::unique_lock<std::mutex> lock(mtx_);
        cv_.wait(lock, [this]{ return !connections_.empty() || active_ < max_size_; });
        
        std::shared_ptr<pqxx::connection> conn;
        if (!connections_.empty()) {
            conn = connections_.front();
            connections_.pop();
        } else {
            conn = std::make_shared<pqxx::connection>(DB_CONN);
            active_++;
        }
        return ConnectionWrapper(conn, *this);
    }

private:
    ConnectionPool(size_t max_size) : max_size_(max_size), active_(0) {}
    
    void release(std::shared_ptr<pqxx::connection> conn) {
        std::lock_guard<std::mutex> lock(mtx_);
        if (conn && conn->is_open()) {
            connections_.push(conn);
        } else {
            if (active_ > 0) active_--;
        }
        cv_.notify_one();
    }

    void discard(std::shared_ptr<pqxx::connection> conn) {
        std::lock_guard<std::mutex> lock(mtx_);
        if (active_ > 0) active_--;
        // Соединение не кладется обратно в очередь и будет уничтожено shared_ptr'ом
        cv_.notify_one();
    }

    std::queue<std::shared_ptr<pqxx::connection>> connections_;
    std::mutex mtx_;
    std::condition_variable cv_;
    size_t max_size_;
    size_t active_;
};

inline std::unique_ptr<user_permissions::User> load_user(int user_id) {
    auto conn = ConnectionPool::instance().acquire();
    pqxx::read_transaction T(*conn);
    pqxx::result r = T.exec_params(
        "SELECT role, is_blocked, email, first_name, last_name "
        "FROM app_users WHERE user_id = $1", user_id);
    if (r.empty()) return nullptr;

    auto row = r[0];
    int role_value = row["role"].as<int>();
    Role role = static_cast<Role>(role_value);
    bool blocked = row["is_blocked"].as<bool>();

    auto user = user_permissions::create_user(role);
    user->id = user_id;
    user->is_blocked = blocked;
    user->email = row["email"].as<std::string>();
    user->full_name = row["first_name"].as<std::string>()
                    + " " + row["last_name"].as<std::string>();
    return user;
}