package com.studhub.grade;

import com.studhub.courses.Course;
import com.studhub.courses.CourseRepository;
import com.studhub.courses.Enrollment;
import com.studhub.courses.EnrollmentRepository;
import com.studhub.grade.dto.CreateGradeRequest;
import com.studhub.grade.dto.GradeDto;
import com.studhub.grade.dto.SavePreviewRequest;
import com.studhub.grade.dto.UpdateGradeRequest;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class GradeService {

    private final GradeRepository gradeRepository;
    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;

    public GradeService(GradeRepository gradeRepository,
                        UserRepository userRepository,
                        CourseRepository courseRepository,
                        EnrollmentRepository enrollmentRepository) {
        this.gradeRepository = gradeRepository;
        this.userRepository = userRepository;
        this.courseRepository = courseRepository;
        this.enrollmentRepository = enrollmentRepository;
    }

    @Transactional(readOnly = true)
    public List<GradeDto> getGradesForGroup(Long courseId, String groupName, String subject) {
        List<Grade> grades;
        if (subject != null && !subject.isBlank()) {
            grades = gradeRepository.findByCourseIdAndSubjectAndStudentGroupName(courseId, subject, groupName);
        } else {
            grades = gradeRepository.findByCourseIdAndStudentGroupName(courseId, groupName);
        }
        return grades.stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public GradeDto createGrade(CreateGradeRequest request, Long teacherId) {
        User student = userRepository.findById(request.getStudentId())
                .orElseThrow(() -> new RuntimeException("Student not found"));
        Course course = courseRepository.findById(request.getCourseId())
                .orElseThrow(() -> new RuntimeException("Course not found"));

        gradeRepository.findByCourseIdAndStudentAndSubjectAndDate(
                request.getCourseId(), student, request.getSubject(), request.getDate())
                .ifPresent(g -> {
                    throw new RuntimeException(
                            "Grade already exists for this student, subject and date in this course");
                });

        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));

        Grade grade = new Grade();
        grade.setStudent(student);
        grade.setCourse(course);
        grade.setSubject(request.getSubject());
        grade.setGrade(request.getGrade());
        grade.setDate(request.getDate());
        grade.setTeacher(teacher);

        Grade saved = gradeRepository.save(grade);
        return toDto(saved);
    }

    @Transactional
    public GradeDto updateGrade(Long gradeId, UpdateGradeRequest request, Long teacherId) {
        Grade grade = gradeRepository.findById(gradeId)
                .orElseThrow(() -> new RuntimeException("Grade not found"));
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));
        grade.setGrade(request.getGrade());
        grade.setTeacher(teacher);
        return toDto(gradeRepository.save(grade));
    }

    @Transactional
    public GradeDto updateGradeDate(Long gradeId, LocalDate newDate, Long teacherId) {
        Grade grade = gradeRepository.findById(gradeId)
                .orElseThrow(() -> new RuntimeException("Grade not found"));

        gradeRepository.findByCourseIdAndStudentAndSubjectAndDate(
                grade.getCourse().getId(), grade.getStudent(), grade.getSubject(), newDate)
                .ifPresent(existing -> {
                    if (!existing.getId().equals(gradeId))
                        throw new RuntimeException(
                                "Grade already exists for this student, subject and date");
                });

        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));
        grade.setDate(newDate);
        grade.setTeacher(teacher);
        return toDto(gradeRepository.save(grade));
    }

    @Transactional
    public int updateColumnDate(Long courseId, String group, String subject,
                                LocalDate oldDate, LocalDate newDate, Long teacherId) {
        List<Grade> grades = gradeRepository
                .findByCourseIdAndStudentGroupNameAndSubjectAndDate(courseId, group, subject, oldDate);
        if (grades.isEmpty()) return 0;

        for (Grade grade : grades) {
            Optional<Grade> existing = gradeRepository.findByCourseIdAndStudentAndSubjectAndDate(
                    courseId, grade.getStudent(), subject, newDate);
            if (existing.isPresent() && !existing.get().getId().equals(grade.getId())) {
                String studentName = grade.getStudent().getFirstName()
                        + " " + grade.getStudent().getLastName();
                throw new RuntimeException(
                        "Для студента " + studentName + " уже есть оценка на дату " + newDate);
            }
        }

        grades.forEach(g -> g.setDate(newDate));
        gradeRepository.saveAll(grades);
        return grades.size();
    }

    @Transactional
    public int savePreview(SavePreviewRequest request, Long teacherId) {
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));
        Course course = courseRepository.findById(request.getCourseId())
                .orElseThrow(() -> new RuntimeException("Course not found"));
        String subject = request.getSubject() != null ? request.getSubject() : "Основной предмет";

        // Строим map для поиска студентов курса по имени.
        // Фронтенд передаёт fullName целиком в sp.firstName (sp.lastName пустой),
        // поэтому ищем нечётко: сравниваем fullName из Excel с конкатенацией firstName+lastName из БД.
        List<Enrollment> enrollments = enrollmentRepository.findByCourseId(request.getCourseId());
        List<User> enrolledUsers = enrollments.stream()
                .map(e -> userRepository.findById(e.getUserId()).orElse(null))
                .filter(u -> u != null)
                .collect(Collectors.toList());

        int savedCount = 0;
        int skippedCount = 0;

        for (SavePreviewRequest.StudentPreview sp : request.getStudents()) {
            // sp.firstName содержит полное ФИО из Excel, sp.lastName пустой
            String fullNameFromExcel = (sp.getFirstName() != null ? sp.getFirstName().trim() : "");
            String groupFromExcel    = (sp.getGroup()     != null ? sp.getGroup().trim()     : "");

            User student = enrolledUsers.stream()
                    .filter(u -> {
                        // Полное ФИО в БД: firstName + " " + lastName (или только firstName если lastName пустой)
                        String dbFirst = u.getFirstName() != null ? u.getFirstName().trim() : "";
                        String dbLast  = u.getLastName()  != null ? u.getLastName().trim()  : "";
                        String dbFull  = dbLast.isEmpty() ? dbFirst : (dbFirst + " " + dbLast);
                        String dbGroup = u.getGroupName() != null ? u.getGroupName().trim() : "";
                        return dbFull.equalsIgnoreCase(fullNameFromExcel)
                                && dbGroup.equalsIgnoreCase(groupFromExcel);
                    })
                    .findFirst()
                    .orElse(null);

            // Нечёткий fallback: только по ФИО без учёта группы (на случай расхождения групп)
            if (student == null) {
                student = enrolledUsers.stream()
                        .filter(u -> {
                            String dbFirst = u.getFirstName() != null ? u.getFirstName().trim() : "";
                            String dbLast  = u.getLastName()  != null ? u.getLastName().trim()  : "";
                            String dbFull  = dbLast.isEmpty() ? dbFirst : (dbFirst + " " + dbLast);
                            return dbFull.equalsIgnoreCase(fullNameFromExcel);
                        })
                        .findFirst()
                        .orElse(null);
            }

            if (student == null) {
                skippedCount++;
                continue;
            }

            Map<String, Integer> studentGrades = request.getGrades().get(sp.getId());
            if (studentGrades == null) continue;

            for (Map.Entry<String, Integer> entry : studentGrades.entrySet()) {
                Integer gradeValue = entry.getValue();
                if (gradeValue == null) continue;
                LocalDate date = LocalDate.parse(entry.getKey());
                saveGrade(student, course, subject, String.valueOf(gradeValue), date, teacher);
                savedCount++;
            }
        }

        if (savedCount == 0 && skippedCount > 0) {
            throw new RuntimeException(
                    "Ни один студент из Excel не найден среди записанных на курс (" + skippedCount
                    + " пропущено). Проверьте, что студенты записаны на курс и ФИО совпадает.");
        }

        return savedCount;
    }

    private String buildNameKey(String lastName, String firstName, String groupName) {
        return (lastName  != null ? lastName.trim()  : "") + "|"
             + (firstName != null ? firstName.trim() : "") + "|"
             + (groupName != null ? groupName.trim() : "");
    }

    @Transactional
    public void saveGrade(User student, Course course, String subject,
                          String gradeValue, LocalDate date, User teacher) {
        gradeRepository.findByCourseIdAndStudentAndSubjectAndDate(
                course.getId(), student, subject, date).ifPresentOrElse(
            grade -> {
                grade.setGrade(gradeValue);
                grade.setTeacher(teacher);
                gradeRepository.save(grade);
            },
            () -> {
                Grade grade = new Grade();
                grade.setStudent(student);
                grade.setCourse(course);
                grade.setSubject(subject);
                grade.setGrade(gradeValue);
                grade.setDate(date);
                grade.setTeacher(teacher);
                try {
                    gradeRepository.saveAndFlush(grade);
                } catch (DataIntegrityViolationException e) {
                    Grade concurrent = gradeRepository
                            .findByCourseIdAndStudentAndSubjectAndDate(
                                    course.getId(), student, subject, date)
                            .orElseThrow();
                    concurrent.setGrade(gradeValue);
                    concurrent.setTeacher(teacher);
                    gradeRepository.save(concurrent);
                }
            }
        );
    }

    private GradeDto toDto(Grade grade) {
        return new GradeDto(
            grade.getId(),
            grade.getStudent().getId(),
            grade.getStudent().getFirstName() + " " + grade.getStudent().getLastName(),
            grade.getCourse().getId(),
            grade.getSubject(),
            grade.getGrade(),
            grade.getDate(),
            grade.getTeacher() != null ? grade.getTeacher().getId() : null,
            grade.getTeacher() != null
                    ? grade.getTeacher().getFirstName() + " " + grade.getTeacher().getLastName()
                    : null
        );
    }
}
