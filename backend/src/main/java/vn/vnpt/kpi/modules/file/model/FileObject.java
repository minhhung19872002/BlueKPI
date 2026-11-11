package vn.vnpt.kpi.modules.file.model;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class FileObject {
    private Long id;
    private String bucket;
    private String objectKey;
    private String originalName;
    private String contentType;
    private Long size;
    private String sha256;
    private String scanStatus;
    private String ownerType;
    private Long ownerId;
    private String uploadedBy;
    private LocalDateTime uploadedAt;
    private LocalDate retentionUntil;
}
