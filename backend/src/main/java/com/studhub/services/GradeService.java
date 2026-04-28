package com.studhub.service;

import com.studhub.dto.GradeDto;
import com.studhub.grade.Grade;
import com.studhub.grade.GradeRepository;
import com.studhub.user.User;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class GradeService {

    private final GradeRepository repo;

    public GradeService(GradeRepository repo) { this.repo = repo; }

    public List<GradeDto> getGradesForStudent(User student) {
        return repo.findByStudent(student).stream()
                .map(g -> new GradeDto(g.getId(), g.getStudent().getEmail(),
                        g.getSubject(), g.getGrade(), g.getDate(), g.getTeacherName()))
                .toList();
    }

    public List<GradeDto> getGradesForGroup(String groupName) {
        return repo.findByStudentGroupName(groupName).stream()
                .map(g -> new GradeDto(g.getId(), g.getStudent().getEmail(),
                        g.getSubject(), g.getGrade(), g.getDate(), g.getTeacherName()))
                .toList();
    }

    public void saveAll(List<Grade> grades) {
        repo.saveAll(grades);
    }
}