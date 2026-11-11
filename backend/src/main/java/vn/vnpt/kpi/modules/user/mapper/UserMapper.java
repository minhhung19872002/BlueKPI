package vn.vnpt.kpi.modules.user.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.modules.user.model.AppUser;
import vn.vnpt.kpi.security.DataScope;

import java.util.List;
import java.util.Map;

@Mapper
public interface UserMapper {
    List<AppUser> search(@Param("f") Map<String, Object> f, @Param("scope") DataScope scope, @Param("q") PageQuery q);

    long count(@Param("f") Map<String, Object> f, @Param("scope") DataScope scope);

    AppUser findById(@Param("id") Long id);

    AppUser findByUsername(@Param("username") String username);

    AppUser findByEmail(@Param("email") String email);

    List<Map<String, Object>> options(@Param("orgUnitIds") List<Long> orgUnitIds, @Param("keyword") String keyword);

    int insert(AppUser u);

    int update(AppUser u);

    int updatePassword(@Param("id") Long id, @Param("hash") String hash);

    int softDelete(@Param("id") Long id, @Param("version") Integer version, @Param("by") String by);

    int hardDelete(@Param("id") Long id);

    long countReferences(@Param("id") Long id);

    List<AppUser.UserRoleItem> findRoles(@Param("userId") Long userId);

    int deleteRoles(@Param("userId") Long userId);

    int insertRole(@Param("userId") Long userId, @Param("roleId") Long roleId, @Param("orgUnitId") Long orgUnitId, @Param("by") String by);
}
