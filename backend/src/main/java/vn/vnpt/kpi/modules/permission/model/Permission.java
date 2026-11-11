package vn.vnpt.kpi.modules.permission.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import vn.vnpt.kpi.common.BaseEntity;

@Data
@EqualsAndHashCode(callSuper = true)
public class Permission extends BaseEntity {
    private String code;
    private String name;
    private String module;
    private String menuCode;
    private String menuName;
    private String description;
    private Integer sortOrder;
}
