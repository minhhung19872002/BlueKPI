package vn.vnpt.kpi.integration.kpisource;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * kpi.kpi-source.* — thông tin xác thực nguồn KPI (secret store). Base URL & kiểu xác thực ở sys_config
 * (KPI_SOURCE_BASE_URL, KPI_SOURCE_AUTH_TYPE); giá trị ở đây là mặc định/secret.
 */
@ConfigurationProperties(prefix = "kpi.kpi-source")
public record KpiSourceProperties(String apiKey, String apiKeyHeader, String bearerToken, String basicUser,
                                  String basicPassword, int timeoutSeconds, int retries) {
    public KpiSourceProperties {
        if (apiKeyHeader == null) apiKeyHeader = "X-Api-Key";
        if (timeoutSeconds <= 0) timeoutSeconds = 10;
        if (retries < 0) retries = 2;
    }
}
