package vn.vnpt.kpi.modules.sysconfig.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.modules.sysconfig.model.SysConfig;

import java.util.List;

@Mapper
public interface SysConfigMapper {
    List<SysConfig> findAll();

    List<SysConfig> search(@Param("keyword") String keyword, @Param("group") String group,
                           @Param("dataType") String dataType, @Param("q") PageQuery q);

    long count(@Param("keyword") String keyword, @Param("group") String group, @Param("dataType") String dataType);

    SysConfig findById(@Param("id") Long id);

    SysConfig findByKey(@Param("key") String key);

    int insert(SysConfig c);

    int update(SysConfig c);

    int softDelete(@Param("id") Long id, @Param("version") Integer version, @Param("by") String by);
}
