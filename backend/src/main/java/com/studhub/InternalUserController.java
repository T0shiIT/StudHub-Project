// package com.studhub;

// import com.studhub.user.UserRepository;
// import org.springframework.http.ResponseEntity;
// import org.springframework.security.core.Authentication;
// import org.springframework.web.bind.annotation.*;

// import java.util.HashMap;
// import java.util.Map;

// @RestController
// @RequestMapping("/api/internal")
// public class InternalUserController {

//     private final UserRepository userRepository;

//     public InternalUserController(UserRepository userRepository) {
//         this.userRepository = userRepository;
//     }

//     @GetMapping("/user")
//     public ResponseEntity<Map<String, Object>> getUser(@RequestParam String email) {
//         return userRepository.findByEmail(email.toLowerCase())
//                 .map(u -> {
//                     Map<String, Object> body = new HashMap<>();
//                     body.put("id",         u.getId());
//                     body.put("login",      u.getLogin());
//                     body.put("email",      u.getEmail());
//                     body.put("role",       u.getRole());
//                     body.put("is_blocked", u.getIsBlocked() != null && u.getIsBlocked());
//                     return ResponseEntity.ok(body);
//                 })
//                 .orElse(ResponseEntity.notFound().<Map<String, Object>>build());
//     }

//     @GetMapping("/chat-token")
//     public ResponseEntity<Map<String, Object>> getChatToken(Authentication authentication) {
//         if (authentication == null || !authentication.isAuthenticated())
//             return ResponseEntity.status(401).<Map<String, Object>>build();

//         String email = authentication.getName();
//         return userRepository.findByEmail(email.toLowerCase())
//                 .map(u -> {
//                     Map<String, Object> body = new HashMap<>();
//                     body.put("token", u.getId() + ":" + u.getLogin());
//                     return ResponseEntity.ok(body);
//                 })
//                 .orElse(ResponseEntity.notFound().<Map<String, Object>>build());
//     }
// }

package com.studhub;

import com.studhub.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/internal")
public class InternalUserController {

    private final UserRepository userRepository;

    public InternalUserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/user")
    public ResponseEntity<Map<String, Object>> getUser(@RequestParam String email) {
        return userRepository.findByEmail(email.toLowerCase())
                .map(u -> {
                    Map<String, Object> body = new HashMap<>();
                    body.put("id",         u.getId());
                    body.put("login",      u.getLogin());
                    body.put("email",      u.getEmail());
                    body.put("role",       u.getRole());
                    body.put("is_blocked", u.getIsBlocked() != null && u.getIsBlocked());
                    return ResponseEntity.ok(body);
                })
                .orElse(ResponseEntity.notFound().<Map<String, Object>>build());
    }

    @GetMapping("/chat-token")
    public ResponseEntity<Map<String, Object>> getChatToken(Authentication authentication) {
        // Если нет сессии — возвращаем 401, не редиректим
        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "unauthorized");
            return ResponseEntity.status(401).body(err);
        }

        String email = authentication.getName();
        return userRepository.findByEmail(email.toLowerCase())
                .map(u -> {
                    Map<String, Object> body = new HashMap<>();
                    body.put("token", u.getId() + ":" + u.getLogin());
                    return ResponseEntity.ok(body);
                })
                .orElse(ResponseEntity.notFound().<Map<String, Object>>build());
    }
}