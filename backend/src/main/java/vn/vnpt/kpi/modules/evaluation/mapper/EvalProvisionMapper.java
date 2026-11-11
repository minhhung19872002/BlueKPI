package vn.vnpt.kpi.modules.evaluation.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.Collection;
import java.util.List;

/** Sinh evaluation_kpi / evaluation_result khi chốt giao (31.1) và cập nhật plan_value khi điều chỉnh (34.2) */
@Mapper
public interface EvalProvisionMapper {
    int upsertEvaluationKpis(@Param("detailIds") Collection<Long> detailIds, @Param("by") String by);

    int upsertEvaluationResults(@Param("detailIds") Collection<Long> detailIds, @Param("by") String by);

    List<Long> resultIdsOfDetails(@Param("detailIds") Collection<Long> detailIds);
}
