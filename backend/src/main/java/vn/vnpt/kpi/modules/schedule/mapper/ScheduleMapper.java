package vn.vnpt.kpi.modules.schedule.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.modules.schedule.model.SyncSchedule;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface ScheduleMapper {
    List<SyncSchedule> search(@Param("keyword") String keyword, @Param("q") PageQuery q);

    long count(@Param("keyword") String keyword);

    List<SyncSchedule> findAll();

    SyncSchedule findById(@Param("id") Long id);

    SyncSchedule findByCode(@Param("code") String code);

    int update(SyncSchedule s);

    int updateRun(@Param("id") Long id, @Param("lastRunAt") LocalDateTime lastRunAt, @Param("lastStatus") String lastStatus,
                  @Param("nextRunAt") LocalDateTime nextRunAt);

    int updateNextRun(@Param("id") Long id, @Param("nextRunAt") LocalDateTime nextRunAt);
}
