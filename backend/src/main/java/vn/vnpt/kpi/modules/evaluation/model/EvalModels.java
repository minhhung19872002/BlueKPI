package vn.vnpt.kpi.modules.evaluation.model;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Model Đánh giá KPI (PHẦN B §4.5) */
public final class EvalModels {
    private EvalModels() {}

    /** KPI × kỳ (tab “Tổng hợp BSC theo chỉ tiêu KPI”) */
    @Data
    public static class EvalKpi {
        private Long id;
        private Long kpiId;
        private String kpiCode;
        private String kpiName;
        private Long parentKpiId;
        private String parentKpiCode;
        private Long perspectiveId;
        private String perspectiveName;
        private String perspectiveColor;
        private String unitOfMeasureName;
        private String assigningUnitName;
        private String evaluatingUnitName;
        private Long evaluatingOfficerId;
        private Integer year;
        private String periodCode;
        private String status;
        private String resultType;
        private String dataSource;
        private String targetDataType;
        private String completionFormula;
        private String completionExpression;
        private String resultExpression;
        private String groupAggregation;
        private String groupExpression;
        private Long scoringMethodId;
        private String scoringMethodName;
        private String scoringMethodType;
        private String scoringConfig;
        private Boolean scoreByResult;
        private LocalDateTime lastSyncedAt;
        private Integer unitCount;
        private Integer resultCount;
        private LocalDateTime updatedAt;
        private Integer version;
    }

    /** KPI × kỳ × đơn vị */
    @Data
    public static class Result {
        private Long id;
        private Long evaluationKpiId;
        private Long kpiId;
        private String kpiCode;
        private String kpiName;
        private Long parentKpiId;
        private String perspectiveName;
        private String perspectiveColor;
        private String unitOfMeasureName;
        private Integer year;
        private String periodCode;
        private String evalKpiStatus;
        private Long orgUnitId;
        private String orgUnitCode;
        private String orgUnitName;
        private String unitType;
        private Long assignmentDetailId;
        private BigDecimal weight;
        private BigDecimal planValue;
        private BigDecimal yearPlanValue;
        private BigDecimal kpiResult;
        private BigDecimal prevAdjustment;
        private BigDecimal adjustment;
        private BigDecimal finalResult;
        private BigDecimal completionRate;
        private BigDecimal yearCompletionRate;
        private BigDecimal score;
        private BigDecimal manualScore;
        private BigDecimal bscScore;
        private String rating;
        private String status;
        private String description;
        private String calcError;
        private BigDecimal resultBeforeAdjust;
        private BigDecimal resultAfterAdjust;
        private String feedback;
        private LocalDateTime updatedAt;
        private Integer version;
        private List<ComponentValue> components = new ArrayList<>();
        private List<Result> children = new ArrayList<>();
    }

    @Data
    public static class ComponentValue {
        private Long id;
        private Long resultId;
        private Long componentId;
        private String code;
        private String name;
        private String source;
        private Long formulaDefinitionId;
        private String formulaCode;
        private BigDecimal value;
        private BigDecimal unitProposedValue;
        private BigDecimal prevAdjustment;
        private BigDecimal unitProposedAdjustment;
        private BigDecimal adjustment;
        private BigDecimal finalValue;
        private String note;
        private LocalDateTime syncedAt;
    }

    @Data
    public static class AdjustmentRequest {
        private Long id;
        private Long resultId;
        private String proposalNote;
        private String status;
        private Long requestedById;
        private String requestedByName;
        private String createdBy;
        private LocalDateTime createdAt;
        private String handledBy;
        private LocalDateTime handledAt;
        private String handlingReason;
        private Long decisionFileId;
        private String decisionFileName;
        private List<FileRef> files = new ArrayList<>();
    }

    @Data
    public static class FileRef {
        private Long id;
        private String originalName;
        private Long size;
    }

    @Data
    public static class Feedback {
        private Long id;
        private Long resultId;
        private Long authorId;
        private String authorName;
        private String content;
        private String feedbackType;
        private LocalDateTime at;
    }

    @Data
    public static class StatusEvent {
        private Long id;
        private String fromStatus;
        private String toStatus;
        private String note;
        private LocalDateTime at;
        private String by;
    }
}
