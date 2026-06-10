-- Добавляем status в courses (если ещё нет)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL;

-- Добавляем course_id в таблицу grades (если ещё нет)
ALTER TABLE grades ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(course_id) ON DELETE CASCADE;

-- Удаляем старое уникальное ограничение (если оно называется uk_student_subject_date)
ALTER TABLE grades DROP CONSTRAINT IF EXISTS uk_student_subject_date;

-- Добавляем новое уникальное ограничение с course_id
ALTER TABLE grades ADD CONSTRAINT uk_student_subject_date_course UNIQUE (student_id, subject, date, course_id);

-- Создаём индекс по course_id
CREATE INDEX IF NOT EXISTS idx_grades_course ON grades(course_id);

-- Обновляем существующие записи: заполняем course_id (если нужно – временно по первому курсу, но лучше подставить реальный)
-- ВАЖНО: Если в таблице уже есть данные, нужно выполнить UPDATE для каждого курса, 
-- но поскольку в вашей системе ещё не было course_id, можно пропустить или выполнить условно:
-- UPDATE grades SET course_id = (SELECT MIN(course_id) FROM courses) WHERE course_id IS NULL;