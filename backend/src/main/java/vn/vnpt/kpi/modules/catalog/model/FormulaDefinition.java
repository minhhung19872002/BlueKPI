package vn.vnpt.kpi.modules.catalog.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import vn.vnpt.kpi.common.BaseEntity;

@Data
@EqualsAndHashCode(callSuper = true)
public class FormulaDefinition extends BaseEntity {
    private String code;
    private String name;
    private String definitionType;
    private String dataType;
    private String expression;
    private String sourceDefinition;
    private String apiPath;
    private String httpMethod;
    private String responsePath;
    private String businessDescription;
    private String status;
}
