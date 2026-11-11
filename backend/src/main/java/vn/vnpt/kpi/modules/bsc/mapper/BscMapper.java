package vn.vnpt.kpi.modules.bsc.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/** Tổng hợp BSC (PHẦN B §4.6), chốt kỳ, TGĐ duyệt */
@Mapper
public interface BscMapper {
    /** Tổng hợp theo đơn vị cho (năm, kỳ) trên KPI gốc */
    List<Map<String, Object>> aggregateUnits(@Param("year") int year, @Param("period") String period, @Param("warningRate") BigDecimal warningRate);

    int upsertSummary(Map<String, Object> row);

    int deleteSummaryNotIn(@Param("year") int year, @Param("period") String period, @Param("unitIds") Collection<Long> unitIds);

    List<Map<String, Object>> summaries(@Param("year") int year, @Param("period") String period);

    int updateRank(@Param("year") int year, @Param("period") String period, @Param("unitId") Long unitId, @Param("rank") Integer rank,
                   @Param("group") String group, @Param("prevScore") BigDecimal prevScore, @Param("prevRank") Integer prevRank);

    /** Các đơn vị chưa đủ điều kiện chốt: còn dòng thiếu kết quả hoặc trạng thái khác Đã có KQ / Đã xử lý điều chỉnh */
    List<Map<String, Object>> notEligibleForClose(@Param("year") int year, @Param("period") String period);

    List<Map<String, Object>> notEligibleForApprove(@Param("year") int year, @Param("period") String period);

    List<Long> resultIdsOfPeriod(@Param("year") int year, @Param("period") String period, @Param("statuses") Collection<String> statuses);

    Map<String, Object> periodClosing(@Param("year") int year, @Param("period") String period);

    int insertClosing(@Param("year") int year, @Param("period") String period, @Param("by") String by, @Param("snapshot") String snapshot);

    int approveClosing(@Param("year") int year, @Param("period") String period, @Param("by") String by);

    List<Long> unitIdsOfPeriod(@Param("year") int year, @Param("period") String period);

    int countResultsOfPeriod(@Param("year") int year, @Param("period") String period);
}
