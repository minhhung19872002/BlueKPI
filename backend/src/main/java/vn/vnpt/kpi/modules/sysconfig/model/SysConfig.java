package vn.vnpt.kpi.modules.sysconfig.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import vn.vnpt.kpi.common.BaseEntity;

@Data
@EqualsAndHashCode(callSuper = true)
public class SysConfig extends BaseEntity {
    private String configKey;
    private String configValue;
    private String dataType;
    private String configGroup;
    private String description;
    private Boolean isSecret;
    private Boolean isCore;
}
