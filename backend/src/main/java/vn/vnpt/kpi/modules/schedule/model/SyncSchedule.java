package vn.vnpt.kpi.modules.schedule.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import vn.vnpt.kpi.common.BaseEntity;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
public class SyncSchedule extends BaseEntity {
    private String code;
    private String name;
    private String jobType;
    private String jobTypeName;
    private String cron;
    private String cronDescription;
    private Boolean enabled;
    private String params;
    private LocalDateTime lastRunAt;
    private String lastStatus;
    private LocalDateTime nextRunAt;
}
