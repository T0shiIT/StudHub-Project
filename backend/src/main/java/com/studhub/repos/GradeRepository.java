package com.studhub.grade;

import com.studhub.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface GradeRepository extends JpaRepository<Grade, Long> {
    List<Grade> findByStudent(User student);
    List<Grade> findByStudentGroupName(String groupName); // для преподавателя
}