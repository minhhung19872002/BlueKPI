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
    /** Tên phân hệ tiếng Việt (RoleService.MODULE_NAMES) — không lưu DB */
    private String moduleName;
    private String menuCode;
    private String menuName;
    private String description;
    private Integer sortOrder;
}
