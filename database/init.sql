-- USERS
CREATE TABLE app_users (
    id SERIAL PRIMARY KEY,
    -- user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    group_name VARCHAR(255),
    is_blocked BOOLEAN DEFAULT FALSE,
    role VARCHAR(255) DEFAULT 'GUEST',
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ROLES таблица хранит список доступных ролей
CREATE TABLE roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(255) UNIQUE NOT NULL
);

-- UserRoles
CREATE TABLE user_roles (
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(role_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

