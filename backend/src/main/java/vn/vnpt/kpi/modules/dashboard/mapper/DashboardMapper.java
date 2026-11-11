package vn.vnpt.kpi.modules.dashboard.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;

@Mapper
public interface DashboardMapper {
    Map<String, Object> rootUnit();

    Map<String, Object> unit(@Param("id") Long id);

    List<Long> provinceIds();

    List<Map<String, Object>> stages();

    Map<String, Object> stage(@Param("id") Long id);

    List<Map<String, Object>> kpiRows(@Param("unitIds") Collection<Long> unitIds, @Param("years") Collection<Integer> years, @Param("period") String period,
                                      @Param("kpiId") Long kpiId, @Param("focusOnly") boolean focusOnly);

    LocalDateTime lastUpdated(@Param("unitIds") Collection<Long> unitIds, @Param("years") Collection<Integer> years, @Param("period") String period);

    String latestPeriod(@Param("unitId") Long unitId, @Param("year") int year);

    List<Map<String, Object>> summaries(@Param("unitIds") Collection<Long> unitIds, @Param("rankGroup") String rankGroup, @Param("parentId") Long parentId,
                                        @Param("years") Collection<Integer> years, @Param("period") String period);

    List<Map<String, Object>> breakdown(@Param("kpiId") Long kpiId, @Param("parentId") Long parentId, @Param("year") int year, @Param("period") String period);

    int childCount(@Param("parentId") Long parentId);
}
