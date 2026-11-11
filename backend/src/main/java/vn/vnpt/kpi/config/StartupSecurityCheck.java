package vn.vnpt.kpi.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.security.JwtProperties;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Fail-fast ở production nếu còn secret/credential mặc định hoặc BYPASS_SSO=true (PHẦN B §9.5, CLAUDE.md §4.8).
 */
@Slf4j
@Component
@Profile("prod")
public class StartupSecurityCheck {
    static final List<String> DEFAULT_MARKERS = List.of("dev_only", "changeme", "change-me", "default", "kpi_app_dev",
            "kpi_migrate_dev", "minioadmin", "password", "secret-dev", "dev-secret");

    private final JwtProperties jwt;
    private final Environment env;

    public StartupSecurityCheck(JwtProperties jwt, Environment env) {
        this.jwt = jwt;
        this.env = env;
        verify();
    }

    void verify() {
        List<String> problems = new ArrayList<>();
        if (jwt.bypassSso()) problems.add("BYPASS_SSO phải = false ở production");
        if (isDefault(jwt.jwtSecret())) problems.add("KPI_JWT_SECRET đang dùng giá trị mặc định");
        if (!jwt.cookieSecure()) problems.add("Cookie phải Secure=true ở production (HTTPS)");
        if (isDefault(env.getProperty("spring.datasource.password"))) problems.add("Mật khẩu DB đang dùng giá trị mặc định");
        if (isDefault(env.getProperty("kpi.minio.secret-key"))) problems.add("MinIO secret key đang dùng giá trị mặc định");
        if (isDefault(jwt.piiEncryptionKey())) problems.add("KPI_PII_KEY đang dùng giá trị mặc định");
        if (!problems.isEmpty()) {
            throw new IllegalStateException("StartupSecurityCheck thất bại — từ chối khởi động: " + String.join("; ", problems));
        }
        log.info("StartupSecurityCheck: OK");
    }

    static boolean isDefault(String v) {
        if (v == null || v.isBlank()) return true;
        String l = v.toLowerCase(Locale.ROOT);
        return DEFAULT_MARKERS.stream().anyMatch(l::contains);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ready() {
        log.info("Ứng dụng khởi động ở chế độ production");
    }
}
