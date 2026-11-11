package vn.vnpt.kpi.modules.notification.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.modules.notification.model.Notification;

import java.util.Collection;
import java.util.List;
import java.util.Map;

@Mapper
public interface NotificationMapper {
    int insertBatch(@Param("list") List<Notification> list);

    List<Notification> findByUser(@Param("userId") Long userId, @Param("unreadOnly") boolean unreadOnly, @Param("q") PageQuery q);

    long countByUser(@Param("userId") Long userId, @Param("unreadOnly") boolean unreadOnly);

    int markRead(@Param("id") Long id, @Param("userId") Long userId);

    int markAllRead(@Param("userId") Long userId);

    int updateChannelStatus(@Param("id") Long id, @Param("emailStatus") String emailStatus, @Param("zaloStatus") String zaloStatus);

    /** Người nhận theo quyền (vd MYKPI:VIEW) trong các đơn vị */
    List<Map<String, Object>> findUsersWithPermissionInUnits(@Param("perm") String perm, @Param("unitIds") Collection<Long> unitIds);

    List<Map<String, Object>> findUsersWithPermission(@Param("permPrefix") String permPrefix);

    List<Map<String, Object>> findUsersWithRole(@Param("roleCode") String roleCode);

    List<Map<String, Object>> findUsersByIds(@Param("ids") Collection<Long> ids);
}
