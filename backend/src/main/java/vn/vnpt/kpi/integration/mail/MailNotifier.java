package vn.vnpt.kpi.integration.mail;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/** Email qua Spring Mail SMTP (dev: Mailpit) */
@Slf4j
@Component
public class MailNotifier {
    private final ObjectProvider<JavaMailSender> sender;
    private final String from;

    public MailNotifier(ObjectProvider<JavaMailSender> sender, @Value("${kpi.mail.from:kpi-bsc@vnpt.vn}") String from) {
        this.sender = sender;
        this.from = from;
    }

    public boolean send(String to, String subject, String body) {
        JavaMailSender s = sender.getIfAvailable();
        if (s == null || to == null || to.isBlank()) return false;
        try {
            SimpleMailMessage m = new SimpleMailMessage();
            m.setFrom(from);
            m.setTo(to);
            m.setSubject("[KPI-BSC] " + subject);
            m.setText(body == null ? subject : body);
            s.send(m);
            return true;
        } catch (Exception e) {
            log.warn("Gửi email thất bại tới {}: {}", to, e.getMessage());
            return false;
        }
    }
}
