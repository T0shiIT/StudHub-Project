package com.studhub.course;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

public class CourseException extends RuntimeException {

    private final HttpStatus status;

    public CourseException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() { return status; }

    // --- фабричные методы ---

    public static CourseException notFound(String what) {
        return new CourseException(what + " не найден(а)", HttpStatus.NOT_FOUND);
    }

    public static CourseException forbidden(String message) {
        return new CourseException(message, HttpStatus.FORBIDDEN);
    }

    public static CourseException conflict(String message) {
        return new CourseException(message, HttpStatus.CONFLICT);
    }

    public static CourseException badRequest(String message) {
        return new CourseException(message, HttpStatus.BAD_REQUEST);
    }
}