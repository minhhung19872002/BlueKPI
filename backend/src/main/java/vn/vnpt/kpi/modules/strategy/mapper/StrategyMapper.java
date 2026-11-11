package vn.vnpt.kpi.modules.strategy.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.modules.strategy.model.StrategyModels.Lane;
import vn.vnpt.kpi.modules.strategy.model.StrategyModels.MapKpi;
import vn.vnpt.kpi.modules.strategy.model.StrategyModels.MapLink;
import vn.vnpt.kpi.modules.strategy.model.StrategyModels.MapNode;
import vn.vnpt.kpi.modules.strategy.model.StrategyModels.ObjectiveKpi;
import vn.vnpt.kpi.modules.strategy.model.StrategyModels.Strategy;
import vn.vnpt.kpi.security.DataScope;

import java.util.Collection;
import java.util.List;
import java.util.Map;

@Mapper
public interface StrategyMapper {
    List<Strategy> search(@Param("f") Map<String, Object> f, @Param("scope") DataScope scope, @Param("q") PageQuery q);

    long count(@Param("f") Map<String, Object> f, @Param("scope") DataScope scope);

    Strategy find(@Param("id") Long id);

    Integer maxCodeSeq(@Param("prefix") String prefix);

    int insert(Strategy s);

    int update(Strategy s);

    int softDelete(@Param("id") Long id, @Param("version") Integer version, @Param("by") String by);

    int touch(@Param("id") Long id, @Param("version") Integer version, @Param("viewport") String viewport, @Param("by") String by);

    List<Lane> lanes();

    List<MapNode> nodes(@Param("strategyId") Long strategyId);

    List<MapLink> links(@Param("strategyId") Long strategyId);

    List<MapKpi> kpis(@Param("strategyId") Long strategyId);

    int deleteNodes(@Param("strategyId") Long strategyId);

    int deleteLinks(@Param("strategyId") Long strategyId);

    int deleteKpis(@Param("strategyId") Long strategyId);

    int insertNodes(@Param("strategyId") Long strategyId, @Param("nodes") List<Map<String, Object>> nodes, @Param("by") String by);

    int insertLinks(@Param("strategyId") Long strategyId, @Param("links") List<Map<String, Object>> links, @Param("by") String by);

    int insertKpis(@Param("strategyId") Long strategyId, @Param("kpis") List<Map<String, Object>> kpis, @Param("by") String by);

    /** Mục tiêu hiệu lực theo danh sách id */
    List<Map<String, Object>> objectivesByIds(@Param("ids") Collection<Long> ids);

    List<Long> existingKpiIds(@Param("ids") Collection<Long> ids);

    List<ObjectiveKpi> objectiveKpis(@Param("strategyId") Long strategyId, @Param("objectiveId") Long objectiveId, @Param("unitId") Long unitId,
                                     @Param("year") int year, @Param("period") String period);

    /** Job “Hoàn tất chiến lược” */
    int completeFinished(@Param("year") int year);

    /** Chiến lược mới nhất của đơn vị chứa năm (bản đồ readonly cho Dashboard) */
    Long latestForUnit(@Param("unitId") Long unitId, @Param("year") int year);
}
