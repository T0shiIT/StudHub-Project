package com.studhub.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;

@Component
public class CppUserClient {

    private static final Logger log = LoggerFactory.getLogger(CppUserClient.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String USER_ID_HEADER = "X-User-Id";

    private final RestClient restClient;
    private final String baseUrl;

    public CppUserClient(@Value("${cpp.service.url}") String baseUrl) {
        this.baseUrl = baseUrl;
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .build();
    }

    public Result register(Map<String, String> payload) {
        return call("/api/cpp/register-user", payload);
    }

    public Result syncOAuth(Map<String, String> payload) {
        return call("/api/cpp/sync-oauth-user", payload);
    }

    public Result uploadSchedule(Long userId, Map<String, ?> payload) {
        return call("/api/cpp/schedule/upload-json", payload, userId);
    }

    public Result latestSchedule(Long userId) {
        try {
            ResponseEntity<String> response = restClient.get()
                    .uri("/api/cpp/schedule/latest")
                    .header(USER_ID_HEADER, String.valueOf(userId))
                    .retrieve()
                    .onStatus(status -> true, (req, res) -> { })
                    .toEntity(String.class);

            HttpStatus status = HttpStatus.valueOf(response.getStatusCode().value());
            Map<?, ?> body = parseBody(response.getBody());
            return new Result(status, body);
        } catch (Exception e) {
            log.error("Unexpected error when loading latest schedule", e);
            return new Result(HttpStatus.BAD_GATEWAY,
                    Map.of("error", "C++ сервис недоступен: " + e.getMessage()));
        }
    }

    /**

     * @param userId идентификатор пользователя
     * @param newRole новая роль (например, "admin")
     */
    public Result changeUserRole(Long userId, String newRole) {
        Map<String, Object> payload = Map.of("role", newRole);  // только role в теле
        try {
            ResponseEntity<String> response = restClient.post()
                    .uri("/api/cpp/test_handler/change_role")   // правильный роут
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", String.valueOf(userId)) // userId в заголовке
                    .body(payload)
                    .retrieve()
                    .onStatus(status -> true, (req, res) -> { })
                    .toEntity(String.class);

            HttpStatus status = HttpStatus.valueOf(response.getStatusCode().value());
            Map<?, ?> body = parseBody(response.getBody());
            return new Result(status, body);
        } catch (Exception e) {
            log.error("changeUserRole failed for userId={}", userId, e);
            return new Result(HttpStatus.INTERNAL_SERVER_ERROR,
                    Map.of("error", "Внутренняя ошибка: " + e.getMessage()));
        }
    }
    private Result call(String uri, Map<String, ?> payload) {
        return call(uri, payload, null);
    }

    private Result call(String uri, Map<String, ?> payload, Long userId) {
        try {
            RestClient.RequestBodySpec request = restClient.post()
                    .uri(uri)
                    .contentType(MediaType.APPLICATION_JSON);
            if (userId != null) {
                request = request.header(USER_ID_HEADER, String.valueOf(userId));
            }

            ResponseEntity<String> response = request
                    .body(payload)
                    .retrieve()
                    .onStatus(status -> true, (req, res) -> { })
                    .toEntity(String.class);

            HttpStatus status = HttpStatus.valueOf(response.getStatusCode().value());
            Map<?, ?> body = parseBody(response.getBody());

            if (status.is2xxSuccessful()) {
                log.info("C++ {} responded {} for email={}", uri, status, payload.get("email"));
            } else {
                log.warn("C++ {} returned {} for email={}: {}",
                        uri, status, payload.get("email"), response.getBody());
            }
            return new Result(status, body);
        } catch (RestClientException e) {
            log.error("Failed to call C++ service at {}{} for email={}: {}",
                    baseUrl, uri, payload.get("email"), e.getMessage(), e);
            return new Result(HttpStatus.BAD_GATEWAY,
                    Map.of("error", "C++ сервис недоступен: " + e.getMessage()));
        } catch (Exception e) {
            log.error("Unexpected error when calling C++ service {} for email={}",
                    uri, payload.get("email"), e);
            return new Result(HttpStatus.INTERNAL_SERVER_ERROR,
                    Map.of("error", "Внутренняя ошибка: " + e.getMessage()));
        }
    }

    private Map<?, ?> parseBody(String raw) {
        if (raw == null || raw.isBlank()) {
            return Map.of();
        }
        try {
            return MAPPER.readValue(raw, Map.class);
        } catch (Exception ignore) {
            return Map.of("raw", raw);
        }
    }

    public record Result(HttpStatus status, Map<?, ?> body) {
        public boolean isSuccess() {
            return status.is2xxSuccessful();
        }
    }
}