package vn.vnpt.kpi.modules.notification.model;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class Notification {
    private Long id;
    private Long userId;
    private String eventType;
    private String title;
    private String content;
    private String linkRoute;
    private String linkParams;
    private Boolean isRead;
    private LocalDateTime readAt;
    private String emailStatus;
    private String zaloStatus;
    private LocalDateTime createdAt;
}
