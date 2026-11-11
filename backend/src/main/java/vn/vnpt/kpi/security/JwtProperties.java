package vn.vnpt.kpi.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;

/**
 * kpi.security.* — secret nạp từ biến môi trường (secret store), không hard-code (CLAUDE.md §4.8)
 */
@ConfigurationProperties(prefix = "kpi.security")
public record JwtProperties(
        String jwtSecret,
        String jwtSecretPrevious,
        Duration accessTtl,
        Duration refreshTtl,
        Duration idleTimeout,
        boolean cookieSecure,
        String cookieSameSite,
        String cookieDomain,
        boolean bypassSso,
        List<String> corsAllowedOrigins,
        int loginRateLimitPerMinute,
        String piiEncryptionKey
) {
    public JwtProperties {
        if (accessTtl == null) accessTtl = Duration.ofMinutes(15);
        if (refreshTtl == null) refreshTtl = Duration.ofHours(8);
        if (idleTimeout == null) idleTimeout = Duration.ofMinutes(30);
        if (cookieSameSite == null) cookieSameSite = "Lax";
        if (corsAllowedOrigins == null) corsAllowedOrigins = List.of();
        if (loginRateLimitPerMinute <= 0) loginRateLimitPerMinute = 20;
    }
}
