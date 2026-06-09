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

    // НОВЫЙ МЕТОД для массового обновления даты столбца
    List<Grade> findByStudentGroupNameAndSubjectAndDate(String groupName, String subject, LocalDate date);
}