package com.studhub;

import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/internal")
public class InternalUserController {

    private final UserRepository userRepository;

    public InternalUserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** Поиск по email (используется Go для проверок блокировки). */
    @GetMapping("/user")
    public ResponseEntity<Map<String, Object>> getUser(@RequestParam String email) {
        return userRepository.findByEmail(email.toLowerCase())
                .map(u -> ResponseEntity.ok(toPublicMap(u)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Получить пользователя по ID.
     * Go-мессенджер вызывает этот эндпоинт при каждом DM-подключении
     * и при построении списка диалогов.
     */
    @GetMapping("/user/{id}")
    public ResponseEntity<Map<String, Object>> getUserById(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(u -> ResponseEntity.ok(toPublicMap(u)))
                .orElse(ResponseEntity.notFound().build());
    }

    /** Алиас для обратной совместимости со старым Go-кодом. */
    @GetMapping("/user-by-id")
    public ResponseEntity<Map<String, Object>> getUserByIdLegacy(@RequestParam Long id) {
        return getUserById(id);
    }

    /**
     * Поиск пользователей по частичному совпадению логина, имени или фамилии.
     * Используется фронтендом для автодополнения при создании нового DM.
     *
     * GET /api/internal/users/search?q={query}&limit={1-20}
     *
     * Требует аутентификации (Spring Security проверяет JSESSIONID).
     * Не возвращает заблокированных пользователей.
     */
    @GetMapping("/users/search")
    public ResponseEntity<List<Map<String, Object>>> searchUsers(
            @RequestParam String q,
            @RequestParam(defaultValue = "10") int limit,
            Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(401).build();
        }

        // Ограничиваем размер страницы: минимум 1, максимум 20.
        int pageSize = Math.max(1, Math.min(limit, 20));
        String pattern = q.trim().toLowerCase();

        List<User> found = userRepository.searchByLoginOrName(pattern, PageRequest.of(0, pageSize));

        List<Map<String, Object>> result = found.stream()
                .filter(u -> u.getIsBlocked() == null || !u.getIsBlocked())
                .map(this::toPublicMap)
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /** Выдаёт chat-token для текущего аутентифицированного пользователя. */
    @GetMapping("/chat-token")
    public ResponseEntity<Map<String, Object>> getChatToken(Authentication authentication) {
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
                .orElse(ResponseEntity.notFound().build());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> toPublicMap(User u) {
        Map<String, Object> m = new HashMap<>();
        m.put("id",         u.getId());
        m.put("login",      u.getLogin());
        m.put("firstName",  u.getFirstName()  != null ? u.getFirstName()  : "");
        m.put("lastName",   u.getLastName()   != null ? u.getLastName()   : "");
        m.put("email",      u.getEmail());
        m.put("role",       u.getRole());
        m.put("is_blocked", u.getIsBlocked() != null && u.getIsBlocked());
        return m;
    }
}
