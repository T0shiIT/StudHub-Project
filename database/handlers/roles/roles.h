#pragma once

#include <iostream>

enum class Role : int {
    STUDENT = 1,
    TEACHER = 2,
    ADMIN = 3
};

inline Role int_to_role(int role)
{
    switch(role)
    {
        case 1: return Role::STUDENT;
        case 2: return Role::TEACHER;
        case 3: return Role::ADMIN;
        default: return Role::STUDENT;
    }
}
inline std::string role_to_string(Role role)
{
    switch (role) {
        case Role::TEACHER: return "TEACHER";
        case Role::ADMIN:   return "ADMIN";
        default:            return "STUDENT";
    }
}