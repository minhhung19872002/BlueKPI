package vn.vnpt.kpi.modules.org.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.modules.org.model.OrgUnit;
import vn.vnpt.kpi.security.DataScope;

import java.util.Collection;
import java.util.List;
import java.util.Map;

@Mapper
public interface OrgUnitMapper {
    List<OrgUnit> search(@Param("f") Map<String, Object> f, @Param("scope") DataScope scope, @Param("q") PageQuery q);

    long count(@Param("f") Map<String, Object> f, @Param("scope") DataScope scope);

    List<OrgUnit> findAllActive(@Param("scope") DataScope scope, @Param("assignableOnly") boolean assignableOnly);

    OrgUnit findById(@Param("id") Long id);

    OrgUnit findByCode(@Param("code") String code);

    List<OrgUnit> findByCodes(@Param("codes") Collection<String> codes);

    List<OrgUnit> findByIds(@Param("ids") Collection<Long> ids);

    int insert(OrgUnit o);

    int update(OrgUnit o);

    int updatePath(@Param("id") Long id, @Param("path") String path, @Param("level") int level);

    /** Cập nhật path cho cả cây con khi đổi đơn vị cha */
    int rebasePaths(@Param("oldPrefix") String oldPrefix, @Param("newPrefix") String newPrefix, @Param("levelDelta") int levelDelta);

    int softDelete(@Param("id") Long id, @Param("version") Integer version, @Param("by") String by);

    /** Đếm tham chiếu để chặn xóa: con, người dùng, giao KPI, đánh giá */
    Map<String, Object> countReferences(@Param("id") Long id);
}
