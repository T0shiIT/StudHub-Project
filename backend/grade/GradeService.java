package com.studhub.grade;

import com.studhub.grade.dto.CreateGradeRequest;
import com.studhub.grade.dto.GradeDto;
import com.studhub.grade.dto.UpdateGradeRequest;
import com.studhub.notification.NotificationService;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class GradeService {

    private final GradeRepository gradeRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public GradeService(GradeRepository gradeRepository,
                        UserRepository userRepository,
                        NotificationService notificationService) {
        this.gradeRepository = gradeRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public List<GradeDto> getGradesForGroup(String groupName, String subject) {
        List<Grade> grades = (subject != null && !subject.isBlank())
                ? gradeRepository.findBySubjectAndStudentGroupName(subject, groupName)
                : gradeRepository.findByStudentGroupName(groupName);
        return grades.stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<GradeDto> getGradesForStudent(Long studentId) {
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));
        return gradeRepository.findByStudent(student).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public GradeDto updateGrade(Long gradeId, UpdateGradeRequest request, Long teacherId) {
        Grade grade = gradeRepository.findById(gradeId)
                .orElseThrow(() -> new RuntimeException("Grade not found"));
        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));

        grade.setGrade(request.getGrade());
        grade.setTeacher(teacher);
        Grade saved = gradeRepository.save(grade);

        // ── Уведомление студенту ─────────────────────────────────────────────
        notificationService.notifyGrade(saved.getStudent(), saved.getSubject(), saved.getGrade(), false);
        // ─────────────────────────────────────────────────────────────────────

        return toDto(saved);
    }

    @Transactional
    public GradeDto createGrade(CreateGradeRequest request, Long teacherId) {
        User student = userRepository.findById(request.getStudentId())
                .orElseThrow(() -> new RuntimeException("Student not found"));

        gradeRepository.findByStudentAndSubjectAndDate(student, request.getSubject(), request.getDate())
                .ifPresent(g -> {
                    throw new RuntimeException("Grade already exists for this student, subject and date");
                });

        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> new RuntimeException("Teacher not found"));

        Grade grade = new Grade();
        grade.setStudent(student);
        grade.setSubject(request.getSubject());
        grade.setGrade(request.getGrade());
        grade.setDate(request.getDate());
        grade.setTeacher(teacher);

        Grade saved = gradeRepository.save(grade);

        // ── Уведомление студенту ─────────────────────────────────────────────
        notificationService.notifyGrade(student, request.getSubject(), request.getGrade(), true);
        // ─────────────────────────────────────────────────────────────────────

        return toDto(saved);
    }

    @Transactional
    public void saveGrade(User student, String subject, String gradeValue, LocalDate date, User teacher) {
        gradeRepository.findByStudentAndSubjectAndDate(student, subject, date).ifPresentOrElse(
                grade -> {
                    grade.setGrade(gradeValue);
                    grade.setTeacher(teacher);
                    gradeRepository.save(grade);
                    notificationService.notifyGrade(student, subject, gradeValue, false);
                },
                () -> {
                    Grade grade = new Grade();
                    grade.setStudent(student);
                    grade.setSubject(subject);
                    grade.setGrade(gradeValue);
                    grade.setDate(date);
                    grade.setTeacher(teacher);
                    try {
                        gradeRepository.saveAndFlush(grade);
                        notificationService.notifyGrade(student, subject, gradeValue, true);
                    } catch (DataIntegrityViolationException e) {
                        Grade concurrent = gradeRepository
                                .findByStudentAndSubjectAndDate(student, subject, date)
                                .orElseThrow();
                        concurrent.setGrade(gradeValue);
                        concurrent.setTeacher(teacher);
                        gradeRepository.save(concurrent);
                        notificationService.notifyGrade(student, subject, gradeValue, false);
                    }
                }
        );
    }

    private GradeDto toDto(Grade grade) {
        return new GradeDto(
                grade.getId(),
                grade.getStudent().getId(),
                grade.getStudent().getFirstName() + " " + grade.getStudent().getLastName(),
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
