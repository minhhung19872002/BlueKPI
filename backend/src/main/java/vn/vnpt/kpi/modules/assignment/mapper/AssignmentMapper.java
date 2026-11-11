package vn.vnpt.kpi.modules.assignment.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.Adjustment;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.AdjustmentLine;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.ByKpiRow;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.Detail;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.Header;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.HistoryRow;
import vn.vnpt.kpi.security.DataScope;

import java.util.Collection;
import java.util.List;
import java.util.Map;

@Mapper
public interface AssignmentMapper {
    // ---------- Header ----------
    List<Header> searchHeaders(@Param("f") Map<String, Object> f, @Param("scope") DataScope scope, @Param("q") PageQuery q);

    long countHeaders(@Param("f") Map<String, Object> f, @Param("scope") DataScope scope);

    Header findHeader(@Param("id") Long id);

    Header findHeaderByUnitYear(@Param("orgUnitId") Long orgUnitId, @Param("year") int year);

    List<Header> findHeadersByIds(@Param("ids") Collection<Long> ids);

    int insertHeader(Header h);

    int touchHeader(@Param("id") Long id, @Param("by") String by);

    int refreshHeaderStatus(@Param("id") Long id);

    int deleteHeader(@Param("id") Long id);

    // ---------- Detail ----------
    List<Detail> findDetailsOfHeader(@Param("assignmentId") Long assignmentId);

    List<Detail> findDetailsOfKpiYear(@Param("kpiId") Long kpiId, @Param("year") int year, @Param("scope") DataScope scope);

    List<Detail> findDetailsOfKpiYears(@Param("keys") List<Map<String, Object>> keys);

    Detail findDetail(@Param("id") Long id);

    Detail findDetailByKey(@Param("kpiId") Long kpiId, @Param("orgUnitId") Long orgUnitId, @Param("year") int year);

    List<Detail> findDetailsByIds(@Param("ids") Collection<Long> ids);

    int insertDetail(Detail d);

    int updateDetail(Detail d);

    int deleteDetail(@Param("id") Long id);

    int setDetailStatus(@Param("ids") Collection<Long> ids, @Param("status") String status, @Param("by") String by);

    int applyAdjustment(@Param("id") Long id, @Param("col") String col, @Param("value") java.math.BigDecimal value, @Param("by") String by);

    List<Long> headerIdsOfDetails(@Param("ids") Collection<Long> ids);

    // ---------- Theo chỉ tiêu ----------
    List<ByKpiRow> searchByKpi(@Param("f") Map<String, Object> f, @Param("scope") DataScope scope, @Param("q") PageQuery q);

    long countByKpi(@Param("f") Map<String, Object> f, @Param("scope") DataScope scope);

    List<ByKpiRow> byKpiChildren(@Param("parentIds") Collection<Long> parentIds, @Param("years") Collection<Integer> years, @Param("scope") DataScope scope);

    // ---------- Lịch sử ----------
    int insertHistory(@Param("detailId") Long detailId, @Param("action") String action, @Param("decisionNo") String decisionNo,
                      @Param("decisionDate") java.time.LocalDate decisionDate, @Param("reason") String reason, @Param("snapshot") String snapshot, @Param("by") String by);

    // ---------- Điều chỉnh ----------
    Adjustment findDraftAdjustment(@Param("kpiId") Long kpiId, @Param("year") int year);

    List<AdjustmentLine> findAdjustmentLines(@Param("adjustmentId") Long adjustmentId);

    int insertAdjustment(Adjustment a);

    int updateAdjustment(Adjustment a);

    int deleteAdjustmentLines(@Param("adjustmentId") Long adjustmentId);

    int insertAdjustmentLine(AdjustmentLine l);

    List<HistoryRow> adjustmentHistory(@Param("detailId") Long detailId);

    /** Kỳ đã chốt đánh giá (khóa cột ĐC) */
    List<String> closedPeriods(@Param("year") int year);

    // ---------- Sao chép ----------
    List<Map<String, Object>> unitAssignStatus(@Param("year") int year, @Param("kpiId") Long kpiId);
}
