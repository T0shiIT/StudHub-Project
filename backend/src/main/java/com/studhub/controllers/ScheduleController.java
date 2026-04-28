package com.studhub.controller;

import com.studhub.dto.ScheduleDto;
import com.studhub.service.ScheduleService;
import com.studhub.user.User;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;

@RestController
public class ScheduleController {

    private final ScheduleService scheduleService;

    public ScheduleController(ScheduleService scheduleService) {
        this.scheduleService = scheduleService;
    }

    @GetMapping("/api/schedule")
    public List<ScheduleDto> getSchedule(Authentication auth) {
        User user = ((UserDetailsImpl) auth.getPrincipal()).getUser();
        return scheduleService.getScheduleForGroup(user.getGroupName());
    }
}