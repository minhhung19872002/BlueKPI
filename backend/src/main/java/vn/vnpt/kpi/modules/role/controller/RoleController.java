package vn.vnpt.kpi.modules.role.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vnpt.kpi.common.ApiResponse;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.modules.permission.model.Permission;
import vn.vnpt.kpi.modules.role.model.Role;
import vn.vnpt.kpi.modules.role.service.RoleService;

import java.util.List;
import java.util.Map;

@Tag(name = "Vai trò / Quyền", description = "4.1–4.9")
@RestController
@RequiredArgsConstructor
public class RoleController {
    private final RoleService service;
    private final AuditService audit;

    @Operation(summary = "4.1/4.2 Danh sách vai trò")
    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('ROLE:VIEW')")
    public ApiResponse<PageResult<Role>> list(@RequestParam(required = false) String keyword, @RequestParam(required = false) String status, PageQuery q) {
        return ApiResponse.ok(service.search(keyword, status, q));
    }

    @Operation(summary = "Vai trò hiệu lực (dialog gán vai trò)")
    @GetMapping("/roles/active")
    @PreAuthorize("hasAnyAuthority('ROLE:VIEW','USER:ASSIGN_ROLE')")
    public ApiResponse<List<Role>> active() {
        return ApiResponse.ok(service.active());
    }

    @Operation(summary = "4.3 Xem chi tiết vai trò")
    @GetMapping("/roles/{id}")
    @PreAuthorize("hasAuthority('ROLE:VIEW')")
    public ApiResponse<Role> get(@PathVariable Long id) {
        return ApiResponse.ok(service.get(id));
    }

    @Operation(summary = "4.4 Thêm mới vai trò")
    @PostMapping("/roles")
    @PreAuthorize("hasAuthority('ROLE:CREATE')")
    public ApiResponse<Role> create(@Valid @RequestBody RoleService.RoleRequest r) {
        return ApiResponse.ok("Thêm mới thành công", service.create(r));
    }

    @Operation(summary = "4.5 Ghi lại vai trò")
    @PutMapping("/roles/{id}")
    @PreAuthorize("hasAuthority('ROLE:UPDATE')")
    public ApiResponse<Role> update(@PathVariable Long id, @Valid @RequestBody RoleService.RoleRequest r) {
        return ApiResponse.ok("Cập nhật thành công", service.update(id, r));
    }

    @Operation(summary = "4.6 Xóa vai trò (force=true để bỏ gán người dùng)")
    @DeleteMapping("/roles/{id}")
    @PreAuthorize("hasAuthority('ROLE:DELETE')")
    public ApiResponse<Void> delete(@PathVariable Long id, @RequestParam(defaultValue = "false") boolean force, @RequestParam(required = false) Integer version) {
        service.delete(id, force, version);
        return ApiResponse.okMessage("Xóa thành công");
    }

    @GetMapping("/roles/{id}/permissions")
    @PreAuthorize("hasAuthority('ROLE:VIEW')")
    public ApiResponse<List<Long>> permissions(@PathVariable Long id) {
        return ApiResponse.ok(service.get(id).getPermissionIds());
    }

    @PutMapping("/roles/{id}/permissions")
    @PreAuthorize("hasAuthority('ROLE:UPDATE')")
    public ApiResponse<Void> savePermissions(@PathVariable Long id, @RequestBody List<Long> ids) {
        service.get(id);
        service.savePermissions(id, ids);
        audit.log("PHAN_QUYEN", "role", id, null, Map.of("permissionIds", ids));
        return ApiResponse.okMessage("Cập nhật thành công");
    }

    @Operation(summary = "4.7 Danh sách quyền")
    @GetMapping("/permissions")
    @PreAuthorize("hasAuthority('PERMISSION:VIEW')")
    public ApiResponse<PageResult<Permission>> permissionList(@RequestParam(required = false) String keyword, @RequestParam(required = false) String module, PageQuery q) {
        return ApiResponse.ok(service.searchPermissions(keyword, module, q));
    }

    @Operation(summary = "Cây menu → quyền (form vai trò)")
    @GetMapping("/permissions/tree")
    @PreAuthorize("hasAnyAuthority('ROLE:VIEW','PERMISSION:VIEW')")
    public ApiResponse<List<Map<String, Object>>> tree() {
        return ApiResponse.ok(service.permissionTree());
    }

    @Operation(summary = "4.8 Xem chi tiết quyền")
    @GetMapping("/permissions/{id}")
    @PreAuthorize("hasAuthority('PERMISSION:VIEW')")
    public ApiResponse<Map<String, Object>> permission(@PathVariable Long id) {
        return ApiResponse.ok(service.getPermission(id));
    }

    @Operation(summary = "4.9 Ghi lại quyền (mã quyền bất biến)")
    @PutMapping("/permissions/{id}")
    @PreAuthorize("hasAuthority('PERMISSION:UPDATE')")
    public ApiResponse<Permission> updatePermission(@PathVariable Long id, @Valid @RequestBody RoleService.PermissionUpdate u) {
        return ApiResponse.ok("Cập nhật thành công", service.updatePermission(id, u));
    }
}
