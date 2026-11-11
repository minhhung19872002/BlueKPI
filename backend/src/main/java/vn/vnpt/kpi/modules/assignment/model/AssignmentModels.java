package vn.vnpt.kpi.modules.assignment.model;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Model Giao KPI (PHẦN B §4.4) */
public final class AssignmentModels {
    private AssignmentModels() {}

    public static final List<String> PERIODS = List.of("Q1", "Q2", "H1", "Q3", "Q4");

    @Data
    public static class Header {
        private Long id;
        private Long orgUnitId;
        private String orgUnitCode;
        private String orgUnitName;
        private String unitType;
        private Integer year;
        private String status;
        private Integer kpiCount;
        private BigDecimal totalWeight;
        private String createdBy;
        private LocalDateTime createdAt;
        private String updatedBy;
        private LocalDateTime updatedAt;
        private Integer version;
        private List<Detail> details = new ArrayList<>();
    }

    @Data
    public static class Detail {
        private Long id;
        private Long assignmentId;
        private Long kpiId;
        private String kpiCode;
        private String kpiName;
        private Long parentKpiId;
        private String parentKpiCode;
        private String perspectiveName;
        private String perspectiveColor;
        private Integer perspectiveSort;
        private String unitOfMeasureName;
        private Long orgUnitId;
        private String orgUnitCode;
        private String orgUnitName;
        private String unitType;
        private Integer year;
        private BigDecimal weight;
        private BigDecimal targetQ1;
        private BigDecimal targetQ2;
        private BigDecimal targetH1;
        private BigDecimal targetQ3;
        private BigDecimal targetQ4;
        private BigDecimal targetYear;
        private BigDecimal adjQ1;
        private BigDecimal adjQ2;
        private BigDecimal adjH1;
        private BigDecimal adjQ3;
        private BigDecimal adjQ4;
        private String status;
        private String note;
        private String updatedBy;
        private LocalDateTime updatedAt;
        private Integer version;

        public BigDecimal target(String p) {
            return switch (p) {
                case "Q1" -> targetQ1;
                case "Q2" -> targetQ2;
                case "H1" -> targetH1;
                case "Q3" -> targetQ3;
                case "Q4" -> targetQ4;
                default -> targetYear;
            };
        }

        public BigDecimal adj(String p) {
            return switch (p) {
                case "Q1" -> adjQ1;
                case "Q2" -> adjQ2;
                case "H1" -> adjH1;
                case "Q3" -> adjQ3;
                case "Q4" -> adjQ4;
                default -> null;
            };
        }
    }

    /** Dòng tổng hợp tab “Danh sách giao KPI theo chỉ tiêu” */
    @Data
    public static class ByKpiRow {
        private Long kpiId;
        private String kpiCode;
        private String kpiName;
        private Long parentKpiId;
        private String perspectiveName;
        private String perspectiveColor;
        private String unitOfMeasureName;
        private String assigningUnitName;
        private Integer year;
        private Integer unitCount;
        private Integer draftCount;
        private Integer assignedCount;
        private Integer adjustedCount;
        private String status;
        private LocalDateTime updatedAt;
        private List<ByKpiRow> children = new ArrayList<>();

        public String getKey() { return kpiId + "-" + year; }
    }

    @Data
    public static class Adjustment {
        private Long id;
        private Long kpiId;
        private Integer year;
        private String decisionNo;
        private LocalDate decisionDate;
        private String reason;
        private String status;
        private String createdBy;
        private LocalDateTime createdAt;
        private String updatedBy;
        private LocalDateTime updatedAt;
        private List<AdjustmentLine> lines = new ArrayList<>();
    }

    @Data
    public static class AdjustmentLine {
        private Long id;
        private Long adjustmentId;
        private Long detailId;
        private String periodCode;
        private BigDecimal oldValue;
        private BigDecimal newValue;
    }

    /** Dòng lịch sử điều chỉnh (34.3) */
    @Data
    public static class HistoryRow {
        private Long adjustmentId;
        private Integer lan;
        private String decisionNo;
        private LocalDate decisionDate;
        private String reason;
        private String periodCode;
        private BigDecimal oldValue;
        private BigDecimal newValue;
        private String by;
        private LocalDateTime at;
    }
}
