-- USERS
CREATE TABLE app_users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    login VARCHAR(255) UNIQUE NOT NULL,
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

CREATE TABLE user_profile (
    profile_id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    bio TEXT,
    avatar_url VARCHAR(255) DEFAULT 'https://photos.app.goo.gl/3rVQBMCJnd1PWWQ99', --засунуть ссылку из облачного хранилища
    birthday DATE
);


CREATE TABLE study_groups (
    group_id SERIAL PRIMARY KEY,
    group_name VARCHAR(50) UNIQUE NOT NULL,
    kafedra VARCHAR(100)
);

CREATE TABLE schedule_items (
    id SERIAL PRIMARY KEY,
    group_name VARCHAR(255) NOT NULL,      -- e.g. "ИС-2024"
    day_of_week VARCHAR(15) NOT NULL,      -- "Понедельник", "Вторник" …
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    subject VARCHAR(255) NOT NULL,
    teacher VARCHAR(255),
    room VARCHAR(100),
    uploaded_by INTEGER REFERENCES app_users(user_id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -- UserRoles
-- CREATE TABLE user_roles (
--     user_id INTEGER REFERENCES app_users(user_id) ON DELETE CASCADE,
--     role_id INTEGER REFERENCES roles(role_id) ON DELETE CASCADE,
--     PRIMARY KEY (user_id, role_id)
-- );