package vn.vnpt.kpi.modules.org.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import vn.vnpt.kpi.common.BaseEntity;

import java.util.ArrayList;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class OrgUnit extends BaseEntity {
    private String code;
    private String name;
    private String shortName;
    private Long parentId;
    private String parentCode;
    private String parentName;
    private String unitType;
    private String regionCode;
    private Boolean isKpiAssignable;
    private Integer sortOrder;
    private String path;
    private Integer level;
    private String status;
    private String hrmRef;
    private List<OrgUnit> children = new ArrayList<>();
}
