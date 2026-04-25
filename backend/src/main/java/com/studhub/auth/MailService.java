package com.studhub.auth;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

/**
 * Отправляет письма пользователям. Сейчас умеет отправлять письмо
 * для подтверждения email после регистрации.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender mailSender;
    private final String from;
    private final String backendUrl;

    public MailService(JavaMailSender mailSender,
                       @Value("${app.mail.from}") String from,
                       @Value("${app.backend.url}") String backendUrl) {
        this.mailSender = mailSender;
        this.from = from;
        this.backendUrl = backendUrl;
    }

    public void sendVerification(String to, String login, String token) {
        String link = backendUrl + "/api/auth/confirm?token=" + token;
        String html = """
                <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;
                            padding:24px;background:#f9fafb;border-radius:8px;">
                  <h2 style="color:#1e293b;">Подтверждение регистрации в StudHub</h2>
                  <p>Здравствуйте, <b>%s</b>!</p>
                  <p>Для завершения регистрации нажмите на кнопку ниже:</p>
                  <p style="text-align:center;margin:32px 0;">
                    <a href="%s"
                       style="background:#2563eb;color:#fff;text-decoration:none;
                              padding:12px 24px;border-radius:6px;display:inline-block;">
                       Подтвердить email
                    </a>
                  </p>
                  <p style="color:#64748b;font-size:12px;">
                    Если кнопка не работает, скопируйте ссылку в браузер:<br>
                    <a href="%s">%s</a>
                  </p>
                </div>
                """.formatted(escape(login), link, link, link);

        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, false, StandardCharsets.UTF_8.name());
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject("Подтвердите регистрацию в StudHub");
            helper.setText(html, true);
            mailSender.send(mime);
            log.info("Verification email sent to {}", to);
        } catch (MessagingException e) {
            // Отдаём наверх как unchecked, чтобы контроллер вернул осмысленную ошибку.
            throw new IllegalStateException("Не удалось отправить письмо: " + e.getMessage(), e);
        }
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
