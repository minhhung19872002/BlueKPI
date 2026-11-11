package vn.vnpt.kpi.modules.catalog.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import vn.vnpt.kpi.common.BaseEntity;

import java.util.ArrayList;
import java.util.List;

/** Tiêu chí KPI (PHẦN B §4.2.1) + trường hiển thị */
@Data
@EqualsAndHashCode(callSuper = true)
public class Kpi extends BaseEntity {
    private String code;
    private String name;
    private String structure;
    private Long parentId;
    private String parentCode;
    private String groupAggregation;
    private String groupExpression;
    private Long perspectiveId;
    private String perspectiveCode;
    private String perspectiveName;
    private String perspectiveColor;
    private Long groupKpiId;
    private String groupKpiCode;
    private String groupKpiName;
    private String targetDataType;
    private String completionFormula;
    private String completionExpression;
    private Long scoringMethodId;
    private String scoringMethodName;
    private String scoringMethodType;
    private Boolean scoreByResult;
    private Long objectiveId;
    private String objectiveCode;
    private String objectiveName;
    private Integer weight;
    private Long unitOfMeasureId;
    private String unitOfMeasureName;
    private Long assigningUnitId;
    private String assigningUnitName;
    private Long assigningOfficerId;
    private String assigningOfficerName;
    private Long evaluatingUnitId;
    private String evaluatingUnitName;
    private Long evaluatingOfficerId;
    private String evaluatingOfficerName;
    private String dataSource;
    private String resultExpression;
    private Boolean isFocus;
    private Integer sortOrder;
    private String status;
    /** Có khớp điều kiện tìm kiếm (dùng khi hiển thị nhánh cha) */
    private Boolean matched;
    private Integer childCount;
    private Boolean assigned;
    private List<Kpi> children = new ArrayList<>();
    private List<KpiComponent> components = new ArrayList<>();

    @Data
    public static class KpiComponent {
        private Long id;
        private Long kpiId;
        private String code;
        private String name;
        private Long formulaDefinitionId;
        private String formulaCode;
        private String formulaName;
        private String source;
        private Integer sortOrder;
    }
}
