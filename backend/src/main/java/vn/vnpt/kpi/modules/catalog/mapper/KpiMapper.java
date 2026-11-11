package vn.vnpt.kpi.modules.catalog.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.modules.catalog.model.Kpi;

import java.util.Collection;
import java.util.List;
import java.util.Map;

@Mapper
public interface KpiMapper {
    /** KPI gốc (không có cha) khớp điều kiện hoặc có con khớp */
    List<Kpi> searchRoots(@Param("f") Map<String, Object> f, @Param("q") PageQuery q);

    long countRoots(@Param("f") Map<String, Object> f);

    List<Kpi> findChildrenOf(@Param("parentIds") Collection<Long> parentIds, @Param("f") Map<String, Object> f);

    List<Kpi> options(@Param("f") Map<String, Object> f, @Param("limit") int limit);

    Kpi findById(@Param("id") Long id);

    Kpi findByCode(@Param("code") String code);

    List<Kpi> findByIds(@Param("ids") Collection<Long> ids);

    List<Kpi.KpiComponent> findComponents(@Param("kpiId") Long kpiId);

    List<Kpi.KpiComponent> findComponentsOf(@Param("kpiIds") Collection<Long> kpiIds);

    int insert(Kpi k);

    int update(Kpi k);

    int softDelete(@Param("id") Long id, @Param("by") String by);

    Integer lockSequence(@Param("perspectiveId") Long perspectiveId);

    int insertSequence(@Param("perspectiveId") Long perspectiveId, @Param("lastNo") int lastNo);

    int updateSequence(@Param("perspectiveId") Long perspectiveId, @Param("lastNo") int lastNo);

    Integer maxRootNumber(@Param("prefix") String prefix);

    Integer maxChildNumber(@Param("parentCode") String parentCode);

    int insertComponent(Kpi.KpiComponent c);

    int updateComponent(Kpi.KpiComponent c);

    int deleteComponent(@Param("id") Long id);

    long countComponentValues(@Param("componentId") Long componentId);

    long countAssigned(@Param("kpiId") Long kpiId);

    long countInStrategy(@Param("kpiId") Long kpiId);

    int deleteOfficerMap(@Param("kpiId") Long kpiId);

    int insertOfficerMap(@Param("kpiId") Long kpiId, @Param("orgUnitId") Long orgUnitId, @Param("userId") Long userId, @Param("role") String role, @Param("by") String by);

    int countChildren(@Param("parentId") Long parentId);
}
