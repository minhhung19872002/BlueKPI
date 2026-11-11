package vn.vnpt.kpi.modules.sync.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.modules.sync.model.SyncBatch;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Mapper
public interface SyncBatchMapper {
    int insert(SyncBatch b);

    int finish(@Param("id") Long id, @Param("status") String status, @Param("total") int total, @Param("success") int success,
               @Param("failed") int failed, @Param("message") String message);

    SyncBatch findById(@Param("id") Long id);

    List<SyncBatch> recentBySchedule(@Param("scheduleId") Long scheduleId, @Param("limit") int limit);

    List<SyncBatch> recentByJobType(@Param("jobType") String jobType, @Param("limit") int limit);

    int insertItem(@Param("batchId") Long batchId, @Param("formulaId") Long formulaId, @Param("orgUnitId") Long orgUnitId,
                   @Param("request") String request, @Param("value") BigDecimal value, @Param("error") String error);

    List<Map<String, Object>> errorItems(@Param("batchId") Long batchId);

    /** 10 lần đồng bộ gần nhất của định nghĩa KPI công thức (27.3) */
    List<Map<String, Object>> recentItemsByFormula(@Param("formulaId") Long formulaId, @Param("limit") int limit);
}
