package vn.vnpt.kpi.modules.catalog.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import vn.vnpt.kpi.common.BaseEntity;

/** Model các danh mục KPI đơn giản */
public final class CatalogModels {
    private CatalogModels() {}

    @Data
    @EqualsAndHashCode(callSuper = true)
    public static class Uom extends BaseEntity {
        private String code;
        private String name;
        private String description;
        private String status;
    }

    @Data
    @EqualsAndHashCode(callSuper = true)
    public static class Perspective extends BaseEntity {
        private String code;
        private String name;
        private Integer sortOrder;
        private String description;
        private String color;
        private String status;
        private Integer kpiCount;
    }

    @Data
    @EqualsAndHashCode(callSuper = true)
    public static class Objective extends BaseEntity {
        private String code;
        private String name;
        private Long perspectiveId;
        private String perspectiveCode;
        private String perspectiveName;
        private String perspectiveColor;
        private Integer perspectiveSort;
        private String description;
        private String status;
        /** Đã có trên bản đồ chiến lược (dialog 37.1) */
        private Boolean onMap;
    }

    @Data
    public static class ScoringMethod {
        private Long id;
        private String code;
        private String name;
        private String type;
        private String config;
    }

    @Data
    @EqualsAndHashCode(callSuper = true)
    public static class Stage extends BaseEntity {
        private String code;
        private String name;
        private Integer fromYear;
        private Integer toYear;
    }
}
