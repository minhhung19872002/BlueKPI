package vn.vnpt.kpi.modules.role.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.modules.permission.model.Permission;
import vn.vnpt.kpi.modules.role.model.Role;

import java.util.List;
import java.util.Map;

@Mapper
public interface RoleMapper {
    List<Role> search(@Param("keyword") String keyword, @Param("status") String status, @Param("q") PageQuery q);

    long count(@Param("keyword") String keyword, @Param("status") String status);

    List<Role> findActive();

    Role findById(@Param("id") Long id);

    Role findByCode(@Param("code") String code);

    int insert(Role r);

    int update(Role r);

    int softDelete(@Param("id") Long id, @Param("version") Integer version, @Param("by") String by);

    List<Long> findPermissionIds(@Param("roleId") Long roleId);

    int deletePermissions(@Param("roleId") Long roleId);

    int insertPermissions(@Param("roleId") Long roleId, @Param("ids") List<Long> ids);

    List<Long> findUserIdsOfRole(@Param("roleId") Long roleId);

    int deleteUserRoles(@Param("roleId") Long roleId);

    // ---- Quyền ----
    List<Permission> searchPermissions(@Param("keyword") String keyword, @Param("module") String module, @Param("q") PageQuery q);

    long countPermissions(@Param("keyword") String keyword, @Param("module") String module);

    List<Permission> findAllPermissions();

    Permission findPermission(@Param("id") Long id);

    int updatePermission(Permission p);

    List<Map<String, Object>> findRolesHavingPermission(@Param("permissionId") Long permissionId);
}
