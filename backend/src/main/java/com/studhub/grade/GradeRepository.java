package com.studhub.grade;

import com.studhub.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface GradeRepository extends JpaRepository<Grade, Long> {

    List<Grade> findByStudent(User student);

    List<Grade> findByStudentGroupName(String groupName);

    List<Grade> findBySubjectAndStudentGroupName(String subject, String groupName);

    Optional<Grade> findByStudentAndSubjectAndDate(User student, String subject, LocalDate date);

    @Query("SELECT DISTINCT g.subject FROM Grade g WHERE g.student.groupName = :groupName")
    List<String> findDistinctSubjectsByGroupName(@Param("groupName") String groupName);

    List<Grade> findByStudentGroupNameAndSubjectAndDate(String groupName, String subject, LocalDate date);

    // ========== НОВЫЕ МЕТОДЫ С courseId ==========
    List<Grade> findByCourseIdAndStudentGroupName(Long courseId, String groupName);
    List<Grade> findByCourseIdAndSubjectAndStudentGroupName(Long courseId, String subject, String groupName);
    Optional<Grade> findByCourseIdAndStudentAndSubjectAndDate(Long courseId, User student, String subject, LocalDate date);
    List<Grade> findByCourseIdAndStudentGroupNameAndSubjectAndDate(Long courseId, String groupName, String subject, LocalDate date);
    
    @Query("SELECT DISTINCT g.subject FROM Grade g WHERE g.course.id = :courseId AND g.student.groupName = :groupName")
    List<String> findDistinctSubjectsByCourseIdAndGroupName(@Param("courseId") Long courseId, @Param("groupName") String groupName);
}