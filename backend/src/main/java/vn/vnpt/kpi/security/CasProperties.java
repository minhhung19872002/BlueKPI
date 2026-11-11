package vn.vnpt.kpi.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** kpi.cas.* — CAS_SERVER_URL, CAS_SERVICE_URL, CAS_SLO_ENABLED (PHẦN B §8.1) */
@ConfigurationProperties(prefix = "kpi.cas")
public record CasProperties(
        boolean enabled,
        String serverUrl,
        String serviceUrl,
        String protocol,
        boolean sloEnabled,
        String frontendUrl
) {
    public CasProperties {
        if (protocol == null) protocol = "3.0";
        if (frontendUrl == null || frontendUrl.isBlank()) frontendUrl = "/";
        else if (!frontendUrl.endsWith("/")) frontendUrl = frontendUrl + "/"; // ghép "dashboard", "login?error="…
    }

    public String loginUrl() {
        return serverUrl + "/login?service=" + java.net.URLEncoder.encode(serviceUrl, java.nio.charset.StandardCharsets.UTF_8);
    }

    public String validateUrl() {
        return serverUrl + ("2.0".equals(protocol) ? "/serviceValidate" : "/p3/serviceValidate");
    }

    public String logoutUrl() {
        return serverUrl + "/logout?service=" + java.net.URLEncoder.encode(frontendUrl, java.nio.charset.StandardCharsets.UTF_8);
    }
}
