package com.studhub;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TestController {
    
    @GetMapping("/")
    public String home() {
        return "Welcome to StudHub API!";
    }
    
    @GetMapping("/api/test")
    public String test() {
        return "Backend работает!";
    }
}