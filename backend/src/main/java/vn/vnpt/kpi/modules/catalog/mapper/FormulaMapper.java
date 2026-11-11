package vn.vnpt.kpi.modules.catalog.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.modules.catalog.model.FormulaDefinition;

import java.util.List;

@Mapper
public interface FormulaMapper {
    List<FormulaDefinition> search(@Param("keyword") String keyword, @Param("status") String status, @Param("type") String type, @Param("q") PageQuery q);

    long count(@Param("keyword") String keyword, @Param("status") String status, @Param("type") String type);

    List<FormulaDefinition> findAllActive();

    FormulaDefinition findById(@Param("id") Long id);

    FormulaDefinition findByCode(@Param("code") String code);

    int insert(FormulaDefinition f);

    int update(FormulaDefinition f);

    int softDelete(@Param("id") Long id, @Param("version") Integer version, @Param("by") String by);

    long countComponentUsage(@Param("id") Long id);

    List<String> findCodesUsingInExpression(@Param("code") String code);
}
