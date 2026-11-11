package vn.vnpt.kpi.modules.sync.model;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SyncBatch {
    private Long id;
    private String jobType;
    private Integer year;
    private String periodCode;
    private Long kpiId;
    private Long scheduleId;
    private String trigger;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    private String status;
    private Integer total;
    private Integer success;
    private Integer failed;
    private String message;
    private String triggeredBy;
}
