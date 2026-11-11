package vn.vnpt.kpi.common;

import lombok.Data;

import java.time.LocalDateTime;

/** Cột chuẩn mọi bảng nghiệp vụ (CLAUDE.md §4.3) */
@Data
public abstract class BaseEntity {
    private Long id;
    private String createdBy;
    private LocalDateTime createdAt;
    private String updatedBy;
    private LocalDateTime updatedAt;
    private Integer version;
}
