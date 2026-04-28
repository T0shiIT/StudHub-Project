package com.studhub.controller;

import com.studhub.dto.GradeDto;
import com.studhub.security.UserDetailsImpl;
import com.studhub.service.GradeService;
import com.studhub.user.User;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class GradeController {

    private final GradeService gradeService;

    public GradeController(GradeService gradeService) {
        this.gradeService = gradeService;
    }

    @GetMapping("/api/grades")
    public List<GradeDto> getGrades(Authentication auth) {
        User user = ((UserDetailsImpl) auth.getPrincipal()).getUser();
        if (user.getRole() == com.studhub.user.Role.TEACHER) {
            // Преподаватель видит всех студентов своей группы (упрощённо)
            return gradeService.getGradesForGroup(user.getGroupName());
        } else {
            return gradeService.getGradesForStudent(user);
        }
    }
}