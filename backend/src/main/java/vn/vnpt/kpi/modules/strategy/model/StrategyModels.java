package vn.vnpt.kpi.modules.strategy.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import vn.vnpt.kpi.common.BaseEntity;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/** Chiến lược (BSC) và bản đồ chiến lược (36–38) */
public final class StrategyModels {
    private StrategyModels() {}

    @Data
    @EqualsAndHashCode(callSuper = true)
    public static class Strategy extends BaseEntity {
        private String code;
        private String name;
        private Long orgUnitId;
        private String orgUnitCode;
        private String orgUnitName;
        private Long ownerUserId;
        private String ownerName;
        private String ownerUsername;
        private Long stageId;
        private String stageName;
        private Integer stageFromYear;
        private Integer stageToYear;
        private Integer year;
        private String status;
        private String viewport;
        private Integer objectiveCount;
        private Integer kpiCount;
    }

    /** Node mục tiêu trên bản đồ */
    @Data
    public static class MapNode {
        private Long objectiveId;
        private String code;
        private String name;
        private String description;
        private Long perspectiveId;
        private String perspectiveCode;
        private String perspectiveName;
        private String perspectiveColor;
        private Integer perspectiveSort;
        private Double posX;
        private Double posY;
        private List<MapKpi> kpis = new ArrayList<>();
    }

    @Data
    public static class MapKpi {
        private Long objectiveId;
        private Long kpiId;
        private String kpiCode;
        private String kpiName;
    }

    @Data
    public static class MapLink {
        private Long id;
        private Long source;
        private Long target;
        private String sourceHandle;
        private String targetHandle;
    }

    /** Dải viễn cảnh (swimlane) */
    @Data
    public static class Lane {
        private Long id;
        private String code;
        private String name;
        private String color;
        private Integer sortOrder;
    }

    /** 37.4 KPI của mục tiêu kèm kết quả kỳ gần nhất của đơn vị chiến lược */
    @Data
    public static class ObjectiveKpi {
        private Long kpiId;
        private String kpiCode;
        private String kpiName;
        private String unitOfMeasureName;
        private Integer year;
        private String periodCode;
        private String periodName;
        private BigDecimal planValue;
        private BigDecimal finalResult;
        private BigDecimal completionRate;
        private BigDecimal score;
        private String rating;
    }
}
