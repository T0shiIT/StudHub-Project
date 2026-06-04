package com.studhub.schedule;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.studhub.auth.CppUserClient;
import com.studhub.notification.NotificationService;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/schedule")
public class ScheduleController {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".xlsx", ".xlsm", ".xlsb", ".xls");
    private static final String ADMIN_ROLE = "ADMIN";
    private static final String DEFAULT_EMAIL_ATTRIBUTE = "default_email";
    private static final String EMAIL_ATTRIBUTE = "email";
    private static final String SCHEDULE_NOT_FOUND_MESSAGE = "Расписание не найдено";
    private static final String DEFAULT_GROUPS_FILE_NAME_PART = "Группы";
    private static final String FILE_NAME_SEPARATOR = "_";
    private static final String GROUPS_SEPARATOR = "-";
    private static final String DIRECTION_WORD_SEPARATOR = " ";
    private static final int MAX_GROUPS_FILE_NAME_PART_LENGTH = 90;
    private static final Pattern GROUP_VALUE_PATTERN = Pattern.compile(
            "(?iu)(?:^|[\\s,;])(?:группа\\s+)?([\\p{L}][\\p{L}\\d]*(?:[\\s-]+[\\p{L}\\d]+)*-\\s*\\d{2,4}(?:\\(\\d+\\))?)"
    );
    private static final Pattern SUBGROUP_SUFFIX_PATTERN = Pattern.compile("\\(\\d+\\)$");
    private static final Pattern GROUP_NUMBER_SUFFIX_PATTERN = Pattern.compile("-\\s*\\d{2,4}$");
    private static final Pattern INVALID_FILE_NAME_CHARS_PATTERN = Pattern.compile("[\\\\/:*?\"<>|]+");
    private static final Pattern NON_LETTER_PATTERN = Pattern.compile("[^\\p{L}]+");
    private static final Pattern DIRECTION_WORD_SPLIT_PATTERN = Pattern.compile("[\\s_-]+");
    private static final Pattern WHITESPACE_PATTERN = Pattern.compile("\\s+");
    private static final DateTimeFormatter SCHEDULE_DATE_FORMATTER = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final CppUserClient cppUserClient;
    private final ScheduleParserClient scheduleParserClient;
    private final UserRepository userRepository;
    private final ScheduleUploadRepository scheduleUploadRepository;
    private final NotificationService notificationService;   // ← NEW

    public ScheduleController(CppUserClient cppUserClient,
                              ScheduleParserClient scheduleParserClient,
                              UserRepository userRepository,
                              ScheduleUploadRepository scheduleUploadRepository,
                              NotificationService notificationService) {        // ← NEW
        this.cppUserClient = cppUserClient;
        this.scheduleParserClient = scheduleParserClient;
        this.userRepository = userRepository;
        this.scheduleUploadRepository = scheduleUploadRepository;
        this.notificationService = notificationService;    // ← NEW
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadSchedule(@RequestParam("file") MultipartFile file,
                                            Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Пользователь не авторизован"));
        }

        User currentUser = resolveCurrentUser(authentication).orElse(null);
        if (currentUser == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Пользователь не найден"));
        }

        System.out.println("====== DEBUG SCHEDULE UPLOAD ======");
        System.out.println("Email из сессии: " + authentication.getName());
        System.out.println("Email из БД: " + currentUser.getEmail());
        System.out.println("Роль из БД (длина " + currentUser.getRole().length() + "): [" + currentUser.getRole() + "]");
        System.out.println("===================================");

        if (!ADMIN_ROLE.equalsIgnoreCase(currentUser.getRole())) {
            return ResponseEntity.status(403).body(Map.of("error", "Нет прав доступа: требуется роль ADMIN"));
        }

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Файл пустой"));
        }

        String originalName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String extension = extractExtension(originalName);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Поддерживаются форматы: .xlsx, .xlsm, .xlsb, .xls"));
        }

        String scheduleJson;
        try {
            scheduleJson = scheduleParserClient.parseToJson(file);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Ошибка парсинга файла: " + e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Ошибка парсинга файла: " + e.getMessage()));
        }

        JsonNode scheduleData;
        try {
            scheduleData = MAPPER.readTree(scheduleJson);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Некорректный JSON от parser сервиса"));
        }

        String scheduleFileName = buildScheduleFileName(scheduleData);
        JsonNode namedScheduleData = withScheduleFileName(scheduleData, scheduleFileName);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("file_name", scheduleFileName);
        payload.put("file_type", extension);
        payload.put("uploaded_by", currentUser.getEmail());
        payload.put("schedule_json", namedScheduleData);

        CppUserClient.Result saveResult = cppUserClient.uploadSchedule(currentUser.getId(), payload);
        if (!saveResult.isSuccess()) {
            return ResponseEntity.status(saveResult.status()).body(saveResult.body());
        }

        // ── Уведомление всем об обновлении расписания ────────────────────────
        notificationService.notifyScheduleUpdate(scheduleFileName, currentUser.getEmail());
        // ─────────────────────────────────────────────────────────────────────

        Map<String, Object> responseBody = new LinkedHashMap<>();
        responseBody.put("message", "Расписание успешно загружено");
        responseBody.put("id", saveResult.body().get("id"));
        responseBody.put("fileName", scheduleFileName);
        responseBody.put("fileType", extension);
        responseBody.put("uploadedBy", currentUser.getEmail());
        responseBody.put("createdAt", saveResult.body().get("createdAt"));
        responseBody.put("replaced", saveResult.body().get("replaced"));
        responseBody.put("schedule", namedScheduleData);

        return ResponseEntity.ok(responseBody);
    }

    @GetMapping("/uploads")
    public ResponseEntity<?> uploadedSchedules(Authentication authentication) {
        Optional<User> currentUser = requireCurrentUser(authentication);
        if (currentUser.isEmpty()) {
            return unauthorizedResponse(authentication);
        }

        List<Map<String, Object>> schedules = scheduleUploadRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toScheduleSummary)
                .toList();

        return ResponseEntity.ok(Map.of("schedules", schedules));
    }

    @GetMapping("/uploads/{scheduleId}")
    public ResponseEntity<?> uploadedSchedule(@PathVariable Long scheduleId,
                                              Authentication authentication) {
        Optional<User> currentUser = requireCurrentUser(authentication);
        if (currentUser.isEmpty()) {
            return unauthorizedResponse(authentication);
        }

        return scheduleUploadRepository.findById(scheduleId)
                .<ResponseEntity<?>>map(upload -> ResponseEntity.ok(toScheduleResponse(upload)))
                .orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", SCHEDULE_NOT_FOUND_MESSAGE)));
    }

    @GetMapping("/latest")
    public ResponseEntity<?> latestSchedule(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Пользователь не авторизован"));
        }

        User currentUser = resolveCurrentUser(authentication).orElse(null);
        if (currentUser == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Пользователь не найден"));
        }

        CppUserClient.Result result = cppUserClient.latestSchedule(currentUser.getId());
        return ResponseEntity.status(result.status()).body(result.body());
    }

    // ── private helpers (без изменений) ────────────────────────────────────────

    private String buildScheduleFileName(JsonNode scheduleData) {
        Set<String> groupNames = collapseGroupDirections(extractGroupNames(scheduleData));
        String groupsPart = groupNames.isEmpty()
                ? DEFAULT_GROUPS_FILE_NAME_PART
                : String.join(GROUPS_SEPARATOR, groupNames);
        String normalizedGroupsPart = limitFileNamePart(normalizeFileNamePart(groupsPart));
        String datePart = LocalDate.now().format(SCHEDULE_DATE_FORMATTER);
        return normalizedGroupsPart + FILE_NAME_SEPARATOR + datePart;
    }

    private Set<String> extractGroupNames(JsonNode scheduleData) {
        Set<String> groupNames = new LinkedHashSet<>();
        collectGroupNames(scheduleData, groupNames);
        return groupNames;
    }

    private Set<String> collapseGroupDirections(Set<String> groupNames) {
        Set<String> result = new LinkedHashSet<>();
        for (String groupName : groupNames) {
            if (!hasFullDirectionEquivalent(groupName, groupNames)) {
                result.add(groupName);
            }
        }
        return result;
    }

    private boolean hasFullDirectionEquivalent(String groupName, Set<String> groupNames) {
        for (String candidate : groupNames) {
            if (!candidate.equals(groupName) && isAbbreviationOf(groupName, candidate)) {
                return true;
            }
        }
        return false;
    }

    private boolean isAbbreviationOf(String abbreviation, String fullDirectionName) {
        String normalizedAbbreviation = normalizeLetters(abbreviation);
        if (normalizedAbbreviation.length() < 2 || fullDirectionName.length() <= abbreviation.length()) {
            return false;
        }
        return normalizedAbbreviation.equals(buildInitials(fullDirectionName));
    }

    private String normalizeLetters(String value) {
        return NON_LETTER_PATTERN.matcher(value).replaceAll("").toLowerCase(Locale.ROOT);
    }

    private String buildInitials(String value) {
        StringBuilder initials = new StringBuilder();
        for (String word : DIRECTION_WORD_SPLIT_PATTERN.split(value.trim())) {
            if (!word.isBlank()) {
                initials.append(word.charAt(0));
            }
        }
        return initials.toString().toLowerCase(Locale.ROOT);
    }

    private void collectGroupNames(JsonNode node, Set<String> groupNames) {
        if (node == null || node.isNull()) return;
        if (node.isTextual()) { addGroupNames(node.asText(), groupNames); return; }
        if (node.isContainerNode()) {
            node.elements().forEachRemaining(child -> collectGroupNames(child, groupNames));
        }
    }

    private void addGroupNames(String value, Set<String> groupNames) {
        Matcher matcher = GROUP_VALUE_PATTERN.matcher(value);
        while (matcher.find()) {
            String groupName = normalizeGroupName(matcher.group(1));
            if (!groupName.isBlank()) groupNames.add(groupName);
        }
    }

    private String normalizeGroupName(String value) {
        String withoutSubgroupSuffix = SUBGROUP_SUFFIX_PATTERN.matcher(value.trim()).replaceAll("");
        String withoutGroupNumber = GROUP_NUMBER_SUFFIX_PATTERN.matcher(withoutSubgroupSuffix).replaceAll("");
        String directionName = withoutGroupNumber.trim();
        if (!directionName.contains(DIRECTION_WORD_SEPARATOR) && directionName.contains(GROUPS_SEPARATOR)) {
            directionName = directionName.substring(0, directionName.indexOf(GROUPS_SEPARATOR));
        }
        String withoutInvalidCharacters = INVALID_FILE_NAME_CHARS_PATTERN.matcher(directionName).replaceAll("");
        return WHITESPACE_PATTERN.matcher(withoutInvalidCharacters).replaceAll(DIRECTION_WORD_SEPARATOR).trim();
    }

    private String normalizeFileNamePart(String value) {
        String withoutInvalidCharacters = INVALID_FILE_NAME_CHARS_PATTERN.matcher(value.trim()).replaceAll(FILE_NAME_SEPARATOR);
        String normalized = WHITESPACE_PATTERN.matcher(withoutInvalidCharacters).replaceAll(DIRECTION_WORD_SEPARATOR);
        return normalized.isBlank() ? DEFAULT_GROUPS_FILE_NAME_PART : normalized;
    }

    private String limitFileNamePart(String value) {
        return value.length() <= MAX_GROUPS_FILE_NAME_PART_LENGTH
                ? value
                : value.substring(0, MAX_GROUPS_FILE_NAME_PART_LENGTH);
    }

    private JsonNode withScheduleFileName(JsonNode scheduleData, String scheduleFileName) {
        if (scheduleData instanceof ObjectNode objectNode) {
            ObjectNode copy = objectNode.deepCopy();
            copy.put("fileName", scheduleFileName);
            return copy;
        }
        return scheduleData;
    }

    private Optional<User> requireCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return Optional.empty();
        return resolveCurrentUser(authentication);
    }

    private ResponseEntity<?> unauthorizedResponse(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Пользователь не авторизован"));
        }
        return ResponseEntity.status(401).body(Map.of("error", "Пользователь не найден"));
    }

    private Map<String, Object> toScheduleSummary(ScheduleUpload upload) {
        Map<String, Object> responseBody = new LinkedHashMap<>();
        responseBody.put("id", upload.getId());
        responseBody.put("fileName", upload.getFileName());
        responseBody.put("fileType", upload.getFileType());
        responseBody.put("uploadedBy", upload.getUploadedBy());
        responseBody.put("createdAt", upload.getCreatedAt() == null ? null : upload.getCreatedAt().toString());
        return responseBody;
    }

    private Map<String, Object> toScheduleResponse(ScheduleUpload upload) {
        Map<String, Object> responseBody = new LinkedHashMap<>(toScheduleSummary(upload));
        responseBody.put("schedule", withScheduleFileName(upload.getScheduleJson(), upload.getFileName()));
        return responseBody;
    }

    private Optional<User> resolveCurrentUser(Authentication authentication) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof OAuth2User oAuth2User) {
            String email = stringAttribute(oAuth2User, DEFAULT_EMAIL_ATTRIBUTE);
            if (email == null || email.isBlank()) email = stringAttribute(oAuth2User, EMAIL_ATTRIBUTE);
            if (email != null && !email.isBlank()) return userRepository.findByEmail(email.toLowerCase());
        }
        String identifier = authentication.getName();
        if (identifier == null || identifier.isBlank()) return Optional.empty();
        return userRepository.findByEmail(identifier.toLowerCase())
                .or(() -> userRepository.findByLogin(identifier));
    }

    private String stringAttribute(OAuth2User user, String attributeName) {
        Object value = user.getAttribute(attributeName);
        return value == null ? null : value.toString();
    }

    private String extractExtension(String fileName) {
        int idx = fileName.lastIndexOf('.');
        return idx == -1 ? "" : fileName.substring(idx).toLowerCase();
    }
}
