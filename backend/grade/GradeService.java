package com.studhub.grade;

import com.studhub.grade.dto.GradeDto;
import com.studhub.grade.dto.UpdateGradeRequest;
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

    public GradeService(GradeRepository gradeRepository, UserRepository userRepository) {
        this.gradeRepository = gradeRepository;
        this.userRepository = userRepository;
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
        User student = userRepository.findById(studentId).orElseThrow(() -> new RuntimeException("Student not found"));
        return gradeRepository.findByStudent(student).stream().map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public GradeDto updateGrade(Long gradeId, UpdateGradeRequest request, Long teacherId) {
        Grade grade = gradeRepository.findById(gradeId).orElseThrow(() -> new RuntimeException("Grade not found"));
        User teacher = userRepository.findById(teacherId).orElseThrow(() -> new RuntimeException("Teacher not found"));

        grade.setGrade(request.getGrade());
        grade.setTeacher(teacher);
        return toDto(gradeRepository.save(grade));
    }

    @Transactional
    public void saveGrade(User student, String subject, String gradeValue, LocalDate date, User teacher) {
        gradeRepository.findByStudentAndSubjectAndDate(student, subject, date).ifPresentOrElse(
            grade -> {
                grade.setGrade(gradeValue);
                grade.setTeacher(teacher);
                gradeRepository.save(grade);
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
                } catch (DataIntegrityViolationException e) {
                    // Race condition: другой поток уже создал запись. Обновляем её.
                    Grade concurrent = gradeRepository.findByStudentAndSubjectAndDate(student, subject, date).orElseThrow();
                    concurrent.setGrade(gradeValue);
                    concurrent.setTeacher(teacher);
                    gradeRepository.save(concurrent);
                }
            }
        );
    }

    private GradeDto toDto(Grade grade) {
        return new GradeDto(
                grade.getId(), grade.getStudent().getId(),
                grade.getStudent().getFirstName() + " " + grade.getStudent().getLastName(),
                grade.getSubject(), grade.getGrade(), grade.getDate(),
                grade.getTeacher() != null ? grade.getTeacher().getId() : null,
                grade.getTeacher() != null ? grade.getTeacher().getFirstName() + " " + grade.getTeacher().getLastName() : null
        );
    }
}