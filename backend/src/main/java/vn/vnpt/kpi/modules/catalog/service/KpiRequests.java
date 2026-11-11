package vn.vnpt.kpi.modules.catalog.service;

import vn.vnpt.kpi.modules.catalog.dto.KpiRequest;
import vn.vnpt.kpi.modules.catalog.model.Kpi;

/** Chuyển Kpi (đã lưu) → KpiRequest để cập nhật (giữ nguyên các trường) */
public final class KpiRequests {
    private KpiRequests() {}

    public static KpiRequest fromEntity(Kpi k) {
        return new KpiRequest(k.getId(), k.getStructure(), k.getName(), k.getGroupAggregation(), k.getGroupExpression(), k.getPerspectiveId(),
                k.getGroupKpiId(), k.getTargetDataType(), k.getCompletionFormula(), k.getCompletionExpression(), k.getScoringMethodId(),
                k.getScoreByResult(), k.getObjectiveId(), k.getWeight(), k.getAssigningUnitId(), k.getAssigningOfficerId(), k.getEvaluatingUnitId(),
                k.getEvaluatingOfficerId(), k.getDataSource(), k.getUnitOfMeasureId(), k.getIsFocus(), k.getResultExpression(),
                k.getComponents().stream().map(c -> new KpiRequest.ComponentRequest(c.getId(), c.getCode(), c.getName(), c.getFormulaDefinitionId(), c.getSource())).toList(),
                k.getChildren().isEmpty() ? null : k.getChildren().stream().map(KpiRequests::fromEntity).toList(),
                k.getSortOrder(), k.getVersion());
    }
}
