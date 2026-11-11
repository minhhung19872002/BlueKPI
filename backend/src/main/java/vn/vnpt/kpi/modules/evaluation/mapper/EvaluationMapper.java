package vn.vnpt.kpi.modules.evaluation.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.AdjustmentRequest;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.ComponentValue;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.EvalKpi;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.Feedback;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.FileRef;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.Result;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.StatusEvent;
import vn.vnpt.kpi.security.DataScope;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Map;

@Mapper
public interface EvaluationMapper {
    // ---------- KPI × kỳ ----------
    List<EvalKpi> searchEvalKpis(@Param("f") Map<String, Object> f, @Param("scope") DataScope scope, @Param("q") PageQuery q);

    long countEvalKpis(@Param("f") Map<String, Object> f, @Param("scope") DataScope scope);

    EvalKpi findEvalKpi(@Param("id") Long id);

    EvalKpi findEvalKpiByKey(@Param("kpiId") Long kpiId, @Param("year") int year, @Param("period") String period);

    List<EvalKpi> findEvalKpisOfPeriod(@Param("year") int year, @Param("period") String period);

    List<Long> evalKpiIdsWithApi(@Param("year") int year, @Param("periods") Collection<String> periods);

    int setEvalKpiStatus(@Param("id") Long id, @Param("status") String status, @Param("by") String by);

    int touchSynced(@Param("id") Long id);

    // ---------- Kết quả ----------
    /** Kết quả theo bộ lọc chung: evalKpiId, ids, unitId, year, period, keyword, status, statuses, rating */
    List<Result> searchResults(@Param("f") Map<String, Object> f, @Param("scope") DataScope scope, @Param("q") PageQuery q);

    long countResults(@Param("f") Map<String, Object> f, @Param("scope") DataScope scope);

    Result findResult(@Param("id") Long id);

    List<Result> findResultsByIds(@Param("ids") Collection<Long> ids);

    List<Result> findResultsOfEvalKpi(@Param("evalKpiId") Long evalKpiId);

    List<Long> parentResultIds(@Param("ids") Collection<Long> childResultIds);

    List<Long> resultIdsOfPeriod(@Param("year") int year, @Param("period") String period);

    int updateCalc(Result r);

    int updateInput(@Param("id") Long id, @Param("adjustment") BigDecimal adjustment, @Param("description") String description,
                    @Param("manualScore") BigDecimal manualScore, @Param("by") String by);

    int setResultStatus(@Param("ids") Collection<Long> ids, @Param("status") String status, @Param("by") String by);

    /** Điều chỉnh của các kỳ trước cùng năm (ĐC kỳ trước, LŨY KẾ) */
    List<Map<String, Object>> adjustmentsOfYear(@Param("kpiId") Long kpiId, @Param("orgUnitId") Long orgUnitId, @Param("year") int year);

    /** Tổng trọng số KPI gốc của đơn vị trong năm */
    BigDecimal totalRootWeight(@Param("orgUnitId") Long orgUnitId, @Param("year") int year);

    List<Long> parentKpiIds();

    List<Map<String, Object>> childScores(@Param("parentKpiId") Long parentKpiId, @Param("orgUnitId") Long orgUnitId, @Param("year") int year, @Param("period") String period);

    // ---------- Thành phần ----------
    List<ComponentValue> findComponentValues(@Param("resultIds") Collection<Long> resultIds);

    List<ComponentValue> kpiComponents(@Param("kpiId") Long kpiId);

    int setComponentValue(@Param("resultId") Long resultId, @Param("componentId") Long componentId, @Param("source") String source,
                          @Param("value") BigDecimal value, @Param("synced") boolean synced, @Param("note") String note);

    int setComponentProposal(@Param("resultId") Long resultId, @Param("componentId") Long componentId, @Param("value") BigDecimal value,
                             @Param("adjustment") BigDecimal adjustment);

    int setComponentAdjustment(@Param("resultId") Long resultId, @Param("componentId") Long componentId, @Param("adjustment") BigDecimal adjustment);

    int updateComponentCalc(@Param("id") Long id, @Param("prevAdjustment") BigDecimal prevAdjustment, @Param("finalValue") BigDecimal finalValue);

    List<Map<String, Object>> componentAdjustmentsOfYear(@Param("componentId") Long componentId, @Param("orgUnitId") Long orgUnitId, @Param("year") int year);

    // ---------- Đề nghị điều chỉnh / phản hồi / dòng thời gian ----------
    int insertAdjustmentRequest(AdjustmentRequest a);

    AdjustmentRequest findOpenAdjustmentRequest(@Param("resultId") Long resultId);

    List<AdjustmentRequest> findAdjustmentRequests(@Param("resultId") Long resultId);

    int handleAdjustmentRequest(@Param("id") Long id, @Param("by") String by, @Param("byId") Long byId, @Param("reason") String reason, @Param("fileId") Long fileId);

    List<FileRef> filesOf(@Param("ownerType") String ownerType, @Param("ownerId") Long ownerId);

    int insertFeedback(@Param("resultId") Long resultId, @Param("authorId") Long authorId, @Param("content") String content, @Param("type") String type);

    List<Feedback> findFeedback(@Param("resultId") Long resultId);

    int insertStatusEvent(@Param("resultId") Long resultId, @Param("evalKpiId") Long evalKpiId, @Param("from") String from, @Param("to") String to,
                          @Param("note") String note, @Param("by") String by);

    List<StatusEvent> findStatusEvents(@Param("resultId") Long resultId);

    // ---------- Khóa kỳ ----------
    String periodClosingStatus(@Param("year") int year, @Param("period") String period);

    /** Ngày cập nhật kết quả mới nhất */
    java.time.LocalDateTime maxUpdatedAt(@Param("ids") Collection<Long> ids);
}
