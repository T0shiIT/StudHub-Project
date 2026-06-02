-- ============================================================
-- Таблица пользователей (уже была)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    login VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    group_name VARCHAR(255),
    is_blocked BOOLEAN DEFAULT FALSE,
    role VARCHAR(255) DEFAULT 'STUDENT',
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Таблица оценок
-- ============================================================
CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    grade VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    teacher_id INTEGER REFERENCES app_users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_student_subject_date UNIQUE (student_id, subject, date)
);

-- ============================================================
-- Таблица загруженных расписаний
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_uploads (
    id SERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_type VARCHAR(16) NOT NULL,
    schedule_json JSONB NOT NULL,
    uploaded_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Таблица токенов подтверждения email
-- ============================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    login VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- НОВЫЕ ТАБЛИЦЫ ДЛЯ МОДУЛЯ «КУРСЫ»
-- ============================================================

-- 1. Курсы
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    short_name VARCHAR(100),
    category VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',          -- ACTIVE, ARCHIVED, DELETED
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    enrollment_open BOOLEAN NOT NULL DEFAULT TRUE,
    owner_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Записи пользователей на курсы (участники)
CREATE TABLE IF NOT EXISTS course_enrollments (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    course_role VARCHAR(20) NOT NULL DEFAULT 'STUDENT',    -- STUDENT, TEACHER, OWNER
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, user_id)
);

-- 3. Задания / тесты курса
CREATE TABLE IF NOT EXISTS course_assignments (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL DEFAULT 'ASSIGNMENT',       -- ASSIGNMENT, QUIZ
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',         -- ACTIVE, ARCHIVED, DELETED
    max_score INTEGER DEFAULT 100,
    due_date TIMESTAMP WITH TIME ZONE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Записи (лекции, материалы) курса
CREATE TABLE IF NOT EXISTS course_records (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    record_type VARCHAR(50),     -- например, LECTURE, HOMEWORK, QUIZ
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Индексы для ускорения запросов
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_courses_owner_id ON courses(owner_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user ON course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_course_assignments_course ON course_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_records_course ON course_records(course_id);