package vn.vnpt.kpi.modules.role.service;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.Guards;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.modules.permission.model.Permission;
import vn.vnpt.kpi.modules.role.mapper.RoleMapper;
import vn.vnpt.kpi.modules.role.model.Role;
import vn.vnpt.kpi.security.CurrentUser;
import vn.vnpt.kpi.security.UserAuthorityService;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Vai trò (4.1–4.6) và Quyền (4.7–4.9) */
@Service
@RequiredArgsConstructor
public class RoleService {
    static final Map<String, String> SORT = Map.of("code", "r.code", "name", "r.name", "status", "r.status",
            "createdAt", "r.created_at", "updatedAt", "r.updated_at");
    static final Map<String, String> PSORT = Map.of("code", "p.code", "name", "p.name", "module", "p.module", "sortOrder", "p.sort_order");

    /** Tên hiển thị phân hệ trong cây “Phân quyền chức năng” */
    public static final Map<String, String> MODULE_NAMES = new LinkedHashMap<>();
    static {
        MODULE_NAMES.put("DASHBOARD", "Dashboard TGĐ BSC");
        MODULE_NAMES.put("MYKPI", "KPI đơn vị của tôi");
        MODULE_NAMES.put("KPI", "Danh mục chỉ tiêu KPI");
        MODULE_NAMES.put("UOM", "Đơn vị đo");
        MODULE_NAMES.put("PERSPECTIVE", "Viễn cảnh");
        MODULE_NAMES.put("FORMULA", "Định nghĩa KPI công thức");
        MODULE_NAMES.put("OBJECTIVE", "Danh mục mục tiêu trọng tâm");
        MODULE_NAMES.put("ASSIGN", "Giao KPI");
        MODULE_NAMES.put("STRATEGY", "Quản lý bản đồ chiến lược");
        MODULE_NAMES.put("EVAL", "Đánh giá KPI");
        MODULE_NAMES.put("BSC", "Tổng hợp kết quả BSC");
        MODULE_NAMES.put("USER", "Người dùng");
        MODULE_NAMES.put("ROLE", "Vai trò");
        MODULE_NAMES.put("PERMISSION", "Quyền");
        MODULE_NAMES.put("ORG", "Đơn vị");
        MODULE_NAMES.put("SCHEDULE", "Lịch đồng bộ");
        MODULE_NAMES.put("SYSCONFIG", "Tham số hệ thống");
        MODULE_NAMES.put("AUDIT", "Nhật ký hệ thống");
        MODULE_NAMES.put("NOTIFY", "Thông báo");
    }

    public record RoleRequest(
            @NotBlank(message = "Vui lòng nhập Mã vai trò") @Size(max = 50) @Pattern(regexp = "^[A-Za-z0-9_]+$", message = "Mã vai trò chỉ gồm chữ, số và dấu gạch dưới") String code,
            @NotBlank(message = "Vui lòng nhập Tên vai trò") @Size(max = 255) String name,
            @Size(max = 1000) String description,
            @NotBlank(message = "Vui lòng chọn Trạng thái") @Pattern(regexp = "HIEU_LUC|KHONG_HIEU_LUC") String status,
            @Pattern(regexp = "ALL|UNIT|UNIT_AND_CHILDREN", message = "Phạm vi dữ liệu không hợp lệ") String dataScope,
            List<Long> permissionIds,
            Integer version) {}

    public record PermissionUpdate(@NotBlank(message = "Vui lòng nhập Tên quyền") @Size(max = 255) String name,
                                   @Size(max = 1000) String description, Integer sortOrder, Integer version) {}

    private final RoleMapper mapper;
    private final AuditService audit;
    private final UserAuthorityService authorityService;

    public PageResult<Role> search(String keyword, String status, PageQuery q) {
        q.applySort(SORT, "r.is_system DESC, r.id");
        String kw = Strs.like(keyword);
        return PageResult.of(mapper.search(kw, status, q), mapper.count(kw, status), q);
    }

    public List<Role> active() { return mapper.findActive(); }

    public Role get(Long id) {
        Role r = Guards.found(mapper.findById(id), "vai trò");
        r.setPermissionIds(mapper.findPermissionIds(id));
        return r;
    }

    @Transactional
    public Role create(RoleRequest req) {
        if (mapper.findByCode(req.code().trim()) != null) throw BusinessException.field("code", "Mã vai trò đã tồn tại");
        Role r = new Role();
        r.setCode(req.code().trim());
        apply(r, req);
        r.setCreatedBy(CurrentUser.currentUsername());
        r.setUpdatedBy(CurrentUser.currentUsername());
        mapper.insert(r);
        savePermissions(r.getId(), req.permissionIds());
        Role saved = get(r.getId());
        audit.log("THEM", "role", r.getId(), null, saved);
        return saved;
    }

    @Transactional
    public Role update(Long id, RoleRequest req) {
        Role before = get(id);
        if (!before.getCode().equals(req.code().trim())) throw BusinessException.field("code", "Mã vai trò không được sửa");
        Role r = new Role();
        r.setId(id);
        apply(r, req);
        r.setVersion(req.version() == null ? before.getVersion() : req.version());
        r.setUpdatedBy(CurrentUser.currentUsername());
        Guards.updated(mapper.update(r));
        if (req.permissionIds() != null) savePermissions(id, req.permissionIds());
        authorityService.evictAll();
        Role after = get(id);
        audit.log("SUA", "role", id, before, after);
        return after;
    }

    /** 4.6: vai trò hệ thống không xóa được; đang gán cho user → cần xác nhận (force) và sẽ bỏ gán */
    @Transactional
    public void delete(Long id, boolean force, Integer version) {
        Role r = get(id);
        if (Boolean.TRUE.equals(r.getIsSystem())) throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Vai trò hệ thống không được xóa");
        List<Long> users = mapper.findUserIdsOfRole(id);
        if (!users.isEmpty() && !force) {
            throw new BusinessException(ErrorCode.ERR_INVALID_STATE,
                    "Vai trò đang gán cho " + users.size() + " người dùng, tiếp tục xóa sẽ bỏ gán", Map.of("userCount", users.size(), "confirmRequired", true));
        }
        mapper.deleteUserRoles(id);
        mapper.deletePermissions(id);
        Guards.updated(mapper.softDelete(id, version == null ? r.getVersion() : version, CurrentUser.currentUsername()));
        authorityService.evictAll();
        audit.log("XOA", "role", id, r, Map.of("unassignedUsers", users.size()));
    }

    @Transactional
    public void savePermissions(Long roleId, List<Long> ids) {
        mapper.deletePermissions(roleId);
        if (ids != null && !ids.isEmpty()) mapper.insertPermissions(roleId, ids.stream().distinct().toList());
        authorityService.evictAll();
    }

    private static void apply(Role r, RoleRequest req) {
        r.setName(req.name().trim());
        r.setDescription(Strs.trimToNull(req.description()));
        r.setStatus(req.status());
        r.setDataScope(req.dataScope() == null ? "UNIT" : req.dataScope());
    }

    // ---------------- Quyền ----------------
    public PageResult<Permission> searchPermissions(String keyword, String module, PageQuery q) {
        q.applySort(PSORT, "p.sort_order, p.id");
        String kw = Strs.like(keyword);
        return PageResult.of(mapper.searchPermissions(kw, module, q), mapper.countPermissions(kw, module), q);
    }

    public Map<String, Object> getPermission(Long id) {
        Permission p = Guards.found(mapper.findPermission(id), "quyền");
        Map<String, Object> m = new HashMap<>();
        m.put("permission", p);
        m.put("moduleName", MODULE_NAMES.getOrDefault(p.getModule(), p.getModule()));
        m.put("roles", mapper.findRolesHavingPermission(id));
        return m;
    }

    @Transactional
    public Permission updatePermission(Long id, PermissionUpdate u) {
        Permission before = Guards.found(mapper.findPermission(id), "quyền");
        Permission p = new Permission();
        p.setId(id);
        p.setName(u.name().trim());
        p.setDescription(Strs.trimToNull(u.description()));
        p.setSortOrder(u.sortOrder() == null ? before.getSortOrder() : u.sortOrder());
        p.setVersion(u.version() == null ? before.getVersion() : u.version());
        p.setUpdatedBy(CurrentUser.currentUsername());
        Guards.updated(mapper.updatePermission(p));
        Permission after = mapper.findPermission(id);
        audit.log("SUA", "permission", id, before, after);
        return after;
    }

    /** Cây checkbox menu → quyền */
    public List<Map<String, Object>> permissionTree() {
        Map<String, List<Permission>> byModule = new LinkedHashMap<>();
        MODULE_NAMES.keySet().forEach(k -> byModule.put(k, new ArrayList<>()));
        for (Permission p : mapper.findAllPermissions()) byModule.computeIfAbsent(p.getModule(), k -> new ArrayList<>()).add(p);
        List<Map<String, Object>> out = new ArrayList<>();
        byModule.forEach((mod, list) -> {
            if (list.isEmpty()) return;
            Map<String, Object> n = new LinkedHashMap<>();
            n.put("module", mod);
            n.put("name", MODULE_NAMES.getOrDefault(mod, mod));
            n.put("permissions", list);
            out.add(n);
        });
        return out;
    }
}
