package vn.vnpt.kpi.modules.file.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** Tra đơn vị sở hữu của đối tượng gắn tệp (kiểm quyền presigned URL) */
@Mapper
public interface FileOwnerMapper {
    @Select("SELECT r.org_unit_id FROM adjustment_request a JOIN evaluation_result r ON r.id = a.result_id WHERE a.id = #{id}")
    Long unitOfAdjustRequest(@Param("id") Long adjustRequestId);

    @Select("SELECT org_unit_id FROM evaluation_result WHERE id = #{id}")
    Long unitOfResult(@Param("id") Long resultId);
}
