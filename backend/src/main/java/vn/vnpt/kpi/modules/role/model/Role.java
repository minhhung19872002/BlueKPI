package vn.vnpt.kpi.modules.role.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import vn.vnpt.kpi.common.BaseEntity;

import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class Role extends BaseEntity {
    private String code;
    private String name;
    private String description;
    private String status;
    private String dataScope;
    private Boolean isSystem;
    private Integer userCount;
    private List<Long> permissionIds;
}
