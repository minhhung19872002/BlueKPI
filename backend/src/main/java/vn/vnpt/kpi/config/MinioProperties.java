package vn.vnpt.kpi.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "kpi.minio")
public record MinioProperties(String endpoint, String accessKey, String secretKey, String bucket, int presignTtlSeconds) {
    public MinioProperties {
        if (bucket == null) bucket = "kpi-files";
        if (presignTtlSeconds <= 0) presignTtlSeconds = 300;
    }
}
