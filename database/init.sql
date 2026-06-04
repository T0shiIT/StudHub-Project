-- USERS
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

CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES app_users(user_id),
    subject VARCHAR(255) NOT NULL,
    grade VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    teacher_id INTEGER REFERENCES app_users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_student_subject_date UNIQUE (student_id, subject, date)
);

CREATE TABLE IF NOT EXISTS schedule_uploads (
    id SERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_type VARCHAR(16) NOT NULL,
    schedule_json JSONB NOT NULL,
    uploaded_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    login VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
    course_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    teacher_id INTEGER NOT NULL REFERENCES app_users(user_id),
    cover_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS enrollments (
    enrollment_id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    UNIQUE(course_id, user_id)
);

-- Секции курса (категории)
CREATE TABLE IF NOT EXISTS course_sections (
    section_id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Материалы и задания
CREATE TABLE IF NOT EXISTS course_materials (
    material_id SERIAL PRIMARY KEY,
    section_id INTEGER NOT NULL REFERENCES course_sections(section_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    material_type VARCHAR(50) NOT NULL, -- 'FILE', 'ASSIGNMENT', 'LINK', 'TEXT', 'TEST'
    file_path TEXT,
    external_url TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Отправленные работы студентов
CREATE TABLE IF NOT EXISTS material_submissions (
    submission_id SERIAL PRIMARY KEY,
    material_id INTEGER NOT NULL REFERENCES course_materials(material_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(material_id, user_id)
);

CREATE INDEX idx_materials_section ON course_materials(section_id);
CREATE INDEX idx_submissions_material_user ON material_submissions(material_id, user_id);

-- Таблицы тестов (исправлены ссылки на course_materials и app_users)
CREATE TABLE IF NOT EXISTS test_questions (
    id BIGSERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    material_id BIGINT NOT NULL REFERENCES course_materials(material_id) ON DELETE CASCADE,
    correct_option_id BIGINT
);

CREATE TABLE IF NOT EXISTS answer_options (
    id BIGSERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    question_id BIGINT NOT NULL REFERENCES test_questions(id) ON DELETE CASCADE
);

ALTER TABLE test_questions ADD CONSTRAINT fk_correct_option FOREIGN KEY (correct_option_id) REFERENCES answer_options(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS test_attempts (
    id BIGSERIAL PRIMARY KEY,
    material_id BIGINT NOT NULL REFERENCES course_materials(material_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    score_percent INT NOT NULL,
    completed_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS student_answers (
    id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES test_questions(id) ON DELETE CASCADE,
    selected_option_id BIGINT NOT NULL REFERENCES answer_options(id) ON DELETE CASCADE
);

ALTER TABLE courses ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL;