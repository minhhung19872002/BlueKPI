package vn.vnpt.kpi.modules.user.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.Guards;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.common.excel.ExcelColumn;
import vn.vnpt.kpi.common.excel.ExcelExporter;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.modules.org.mapper.OrgUnitMapper;
import vn.vnpt.kpi.modules.org.model.OrgUnit;
import vn.vnpt.kpi.modules.role.mapper.RoleMapper;
import vn.vnpt.kpi.modules.role.model.Role;
import vn.vnpt.kpi.modules.user.dto.UserRequest;
import vn.vnpt.kpi.modules.user.mapper.UserMapper;
import vn.vnpt.kpi.modules.user.model.AppUser;
import vn.vnpt.kpi.security.CurrentUser;
import vn.vnpt.kpi.security.DataScope;
import vn.vnpt.kpi.security.DataScopeService;
import vn.vnpt.kpi.security.PasswordPolicy;
import vn.vnpt.kpi.security.PermissionCodes;
import vn.vnpt.kpi.security.UserAuthorityService;
import vn.vnpt.kpi.security.mapper.SecurityMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Quản lý người dùng (3.1–3.10). Admin đơn vị chỉ quản lý user thuộc phạm vi (DataScope) */
@Service
@RequiredArgsConstructor
public class UserService {
    static final Map<String, String> SORT = Map.of("fullName", "u.full_name", "email", "u.email", "username", "u.username",
            "orgUnitName", "o.name", "status", "u.status", "createdAt", "u.created_at", "updatedAt", "u.updated_at");

    public record RoleAssign(Long roleId, Long orgUnitId) {}

    private final UserMapper mapper;
    private final OrgUnitMapper orgMapper;
    private final RoleMapper roleMapper;
    private final SecurityMapper securityMapper;
    private final DataScopeService scopes;
    private final PasswordEncoder encoder;
    private final AuditService audit;
    private final UserAuthorityService authorityService;

    public Map<String, Object> filter(String keyword, String status, Long orgUnitId) {
        Map<String, Object> f = new HashMap<>();
        f.put("keyword", Strs.like(keyword));
        f.put("status", Strs.trimToNull(status));
        if (orgUnitId != null) {
            OrgUnit o = orgMapper.findById(orgUnitId);
            f.put("orgPath", o == null ? "/-1/" : o.getPath());
        }
        return f;
    }

    public PageResult<AppUser> search(Map<String, Object> f, PageQuery q) {
        DataScope scope = scopes.scopeFor(PermissionCodes.USER_VIEW);
        q.applySort(SORT, "u.id DESC");
        return PageResult.of(mapper.search(f, scope, q), mapper.count(f, scope), q);
    }

    public AppUser get(Long id) {
        AppUser u = Guards.found(mapper.findById(id), "người dùng");
        scopes.assertUnit(PermissionCodes.USER_VIEW, u.getOrgUnitId());
        u.setRoles(mapper.findRoles(id));
        return u;
    }

    public List<Map<String, Object>> options(Long orgUnitId, boolean includeChildren, String keyword) {
        List<Long> units = orgUnitId == null ? null : includeChildren ? scopes.subtree(orgUnitId) : List.of(orgUnitId);
        return mapper.options(units, Strs.like(keyword));
    }

    @Transactional
    public AppUser create(UserRequest r) {
        String username = Strs.trimToNull(r.username());
        if (username == null) throw BusinessException.field("username", "Vui lòng nhập Tên đăng nhập");
        if (mapper.findByUsername(username) != null) throw BusinessException.field("username", "Tên đăng nhập đã tồn tại");
        if (mapper.findByEmail(r.email().trim()) != null) throw BusinessException.field("email", "Email đã tồn tại");
        Guards.found(orgMapper.findById(r.orgUnitId()), "đơn vị");
        scopes.assertUnit(PermissionCodes.USER_CREATE, r.orgUnitId());
        String source = r.authSource() == null ? "BOTH" : r.authSource();
        String hash = null;
        if (!"CAS".equals(source)) {
            if (Strs.isBlank(r.initialPassword())) throw BusinessException.field("initialPassword", "Vui lòng nhập Mật khẩu khởi tạo");
            if (!PasswordPolicy.valid(r.initialPassword())) throw BusinessException.field("initialPassword", PasswordPolicy.MESSAGE);
            hash = encoder.encode(r.initialPassword());
        }
        AppUser u = new AppUser();
        apply(u, r, source);
        u.setUsername(username);
        u.setPasswordHash(hash);
        u.setCreatedBy(CurrentUser.currentUsername());
        u.setUpdatedBy(CurrentUser.currentUsername());
        mapper.insert(u);
        AppUser saved = get(u.getId());
        audit.log("THEM", "app_user", u.getId(), null, saved);
        return saved;
    }

    @Transactional
    public AppUser update(Long id, UserRequest r) {
        AppUser before = get(id);
        scopes.assertUnit(PermissionCodes.USER_UPDATE, before.getOrgUnitId());
        if (r.username() != null && !r.username().isBlank() && !r.username().trim().equals(before.getUsername())) {
            throw BusinessException.field("username", "Không được sửa tên đăng nhập");
        }
        AppUser byEmail = mapper.findByEmail(r.email().trim());
        if (byEmail != null && !byEmail.getId().equals(id)) throw BusinessException.field("email", "Email đã tồn tại");
        Guards.found(orgMapper.findById(r.orgUnitId()), "đơn vị");
        scopes.assertUnit(PermissionCodes.USER_UPDATE, r.orgUnitId());
        String source = r.authSource() == null ? before.getAuthSource() : r.authSource();
        AppUser u = new AppUser();
        apply(u, r, source);
        u.setId(id);
        if (!Strs.isBlank(r.initialPassword())) {
            if (!PasswordPolicy.valid(r.initialPassword())) throw BusinessException.field("initialPassword", PasswordPolicy.MESSAGE);
            u.setPasswordHash(encoder.encode(r.initialPassword()));
        } else if (!"CAS".equals(source) && before.getPasswordHash() == null) {
            throw BusinessException.field("initialPassword", "Vui lòng nhập Mật khẩu khởi tạo cho xác thực nội bộ");
        }
        u.setVersion(r.version() == null ? before.getVersion() : r.version());
        u.setUpdatedBy(CurrentUser.currentUsername());
        Guards.updated(mapper.update(u));
        if (!"HOAT_DONG".equals(r.status())) securityMapper.revokeUserSessions(id);
        authorityService.evict(id);
        AppUser after = get(id);
        audit.log("SUA", "app_user", id, before, after);
        return after;
    }

    /** 3.6: không được xóa chính mình; đã phát sinh dữ liệu → soft delete */
    @Transactional
    public void delete(Long id, Integer version) {
        AppUser u = get(id);
        scopes.assertUnit(PermissionCodes.USER_DELETE, u.getOrgUnitId());
        if (id.equals(CurrentUser.current().getId())) throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Không được xóa chính tài khoản đang đăng nhập");
        securityMapper.revokeUserSessions(id);
        if (mapper.countReferences(id) > 0) {
            Guards.updated(mapper.softDelete(id, version == null ? u.getVersion() : version, CurrentUser.currentUsername()));
        } else {
            mapper.deleteRoles(id);
            mapper.hardDelete(id);
        }
        authorityService.evict(id);
        audit.log("XOA", "app_user", id, u, null);
    }

    /** 3.9 / 3.10 Gán / bỏ gán vai trò (thay thế toàn bộ danh sách đã gán) */
    @Transactional
    public List<AppUser.UserRoleItem> saveRoles(Long userId, List<RoleAssign> items) {
        AppUser u = get(userId);
        scopes.assertUnit(PermissionCodes.USER_ASSIGN_ROLE, u.getOrgUnitId());
        List<AppUser.UserRoleItem> before = mapper.findRoles(userId);
        mapper.deleteRoles(userId);
        for (RoleAssign a : items.stream().distinct().toList()) {
            Role r = Guards.found(roleMapper.findById(a.roleId()), "vai trò");
            if (!"HIEU_LUC".equals(r.getStatus()) && before.stream().noneMatch(b -> b.getRoleId().equals(r.getId()))) {
                throw new BusinessException(ErrorCode.ERR_VALIDATION, "Vai trò " + r.getName() + " không hiệu lực");
            }
            if (a.orgUnitId() != null) {
                Guards.found(orgMapper.findById(a.orgUnitId()), "đơn vị áp dụng");
                scopes.assertUnit(PermissionCodes.USER_ASSIGN_ROLE, a.orgUnitId());
            }
            mapper.insertRole(userId, a.roleId(), a.orgUnitId(), CurrentUser.currentUsername());
        }
        authorityService.evict(userId);
        List<AppUser.UserRoleItem> after = mapper.findRoles(userId);
        audit.log("GAN_VAI_TRO", "app_user", userId, before, after);
        return after;
    }

    public byte[] export(Map<String, Object> f, PageQuery q) {
        List<AppUser> rows = search(f, q.forExport()).items();
        List<ExcelColumn<AppUser>> cols = List.of(
                ExcelColumn.of("Họ tên", AppUser::getFullName, 30),
                ExcelColumn.of("Email", AppUser::getEmail, 30),
                ExcelColumn.of("Tên đăng nhập", AppUser::getUsername),
                ExcelColumn.of("Mã đơn vị", AppUser::getOrgUnitCode),
                ExcelColumn.of("Đơn vị", AppUser::getOrgUnitName, 40),
                ExcelColumn.of("Trạng thái", u -> Labels.of(Labels.USER_STATUS, u.getStatus())),
                ExcelColumn.of("Nguồn xác thực", u -> Labels.of(Labels.AUTH_SOURCE, u.getAuthSource())),
                ExcelColumn.of("Mã vai trò", AppUser::getRoleCodes, 30),
                ExcelColumn.of("Người tạo", AppUser::getCreatedBy),
                ExcelColumn.of("Ngày tạo", AppUser::getCreatedAt),
                ExcelColumn.of("Người cập nhật", AppUser::getUpdatedBy),
                ExcelColumn.of("Ngày cập nhật", AppUser::getUpdatedAt));
        return ExcelExporter.export("Nguoi dung", "DANH SÁCH NGƯỜI DÙNG", cols, rows);
    }

    private static void apply(AppUser u, UserRequest r, String source) {
        u.setFullName(r.fullName().trim());
        u.setEmail(r.email().trim().toLowerCase());
        u.setPhone(Strs.trimToNull(r.phone()));
        u.setOrgUnitId(r.orgUnitId());
        u.setStatus(r.status());
        u.setAuthSource(source);
    }
}
