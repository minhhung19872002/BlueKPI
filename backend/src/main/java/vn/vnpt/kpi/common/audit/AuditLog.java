package vn.vnpt.kpi.common.audit;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AuditLog {
    private Long id;
    private Long userId;
    private String username;
    private String action;
    private String entity;
    private String entityId;
    private String beforeJson;
    private String afterJson;
    private String ip;
    private String userAgent;
    private String traceId;
    private LocalDateTime at;
}
