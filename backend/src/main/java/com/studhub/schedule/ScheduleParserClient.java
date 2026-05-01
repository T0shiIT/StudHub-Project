package com.studhub.schedule;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Component
public class ScheduleParserClient {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper;
    private final String parserServiceUrl;

    public ScheduleParserClient(ObjectMapper objectMapper,
                                @Value("${parser.service.url:http://parser:8000}") String parserServiceUrl) {
        this.objectMapper = objectMapper;
        this.parserServiceUrl = parserServiceUrl;
    }

    public String parseToJson(MultipartFile file) {
        try {
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", asResource(file));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    parserServiceUrl + "/parse",
                    HttpMethod.POST,
                    request,
                    String.class
            );

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new IllegalStateException("Parser service returned an invalid response");
            }

            // Убедимся, что это валидный JSON перед сохранением в jsonb.
            return objectMapper.readTree(response.getBody()).toString();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to read uploaded file", e);
        } catch (RestClientException e) {
            throw new IllegalStateException("Parser service is unavailable", e);
        }
    }

    private ByteArrayResource asResource(MultipartFile file) throws IOException {
        return new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return file.getOriginalFilename();
            }
        };
    }
}
