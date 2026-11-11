package vn.vnpt.kpi.modules.sysconfig.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
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
import vn.vnpt.kpi.common.audit.AuditLog;
import vn.vnpt.kpi.common.audit.AuditMapper;
import vn.vnpt.kpi.modules.sysconfig.model.SysConfig;
import vn.vnpt.kpi.modules.sysconfig.service.SysConfigAdminService;

import java.time.LocalDate;
import java.util.Map;

@Tag(name = "Tham số hệ thống", description = "26.20–26.24 + Nhật ký hệ thống")
@RestController
@RequiredArgsConstructor
public class SysConfigController {
    private final SysConfigAdminService service;
    private final AuditMapper auditMapper;

    @Operation(summary = "26.20 Danh sách tham số hệ thống")
    @GetMapping("/sys-configs")
    @PreAuthorize("hasAuthority('SYSCONFIG:VIEW')")
    public ApiResponse<PageResult<SysConfig>> list(@RequestParam(required = false) String keyword, @RequestParam(required = false) String configGroup,
                                                   @RequestParam(required = false) String dataType, PageQuery q) {
        return ApiResponse.ok(service.search(keyword, configGroup, dataType, q));
    }

    @Operation(summary = "26.21 Xem chi tiết")
    @GetMapping("/sys-configs/{id}")
    @PreAuthorize("hasAuthority('SYSCONFIG:VIEW')")
    public ApiResponse<SysConfig> get(@PathVariable Long id) {
        return ApiResponse.ok(service.get(id));
    }

    @Operation(summary = "26.22 Thêm mới")
    @PostMapping("/sys-configs")
    @PreAuthorize("hasAuthority('SYSCONFIG:CREATE')")
    public ApiResponse<SysConfig> create(@Valid @RequestBody SysConfigAdminService.ConfigRequest r) {
        return ApiResponse.ok("Thêm mới thành công", service.create(r));
    }

    @Operation(summary = "26.23 Ghi lại (evict cache cấu hình)")
    @PutMapping("/sys-configs/{id}")
    @PreAuthorize("hasAuthority('SYSCONFIG:UPDATE')")
    public ApiResponse<SysConfig> update(@PathVariable Long id, @Valid @RequestBody SysConfigAdminService.ConfigRequest r) {
        return ApiResponse.ok("Cập nhật thành công", service.update(id, r));
    }

    @Operation(summary = "26.24 Xóa (không xóa tham số lõi)")
    @DeleteMapping("/sys-configs/{id}")
    @PreAuthorize("hasAuthority('SYSCONFIG:DELETE')")
    public ApiResponse<Void> delete(@PathVariable Long id, @RequestParam(required = false) Integer version) {
        service.delete(id, version);
        return ApiResponse.okMessage("Xóa thành công");
    }

    @Operation(summary = "Nhật ký hệ thống (chỉ Admin hệ thống) — bổ sung ngoài E-HSMT")
    @GetMapping("/audit-logs")
    @PreAuthorize("hasAuthority('AUDIT:VIEW')")
    public ApiResponse<PageResult<AuditLog>> audit(@RequestParam(required = false) String username, @RequestParam(required = false) String action,
                                                   @RequestParam(required = false) String entity,
                                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
                                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
                                                   PageQuery q) {
        q.applySort(Map.of("at", "at", "username", "username", "action", "action"), "at DESC");
        var from = fromDate == null ? null : fromDate.atStartOfDay();
        var to = toDate == null ? null : toDate.plusDays(1).atStartOfDay();
        return ApiResponse.ok(PageResult.of(auditMapper.search(username, action, entity, from, to, q), auditMapper.count(username, action, entity, from, to), q));
    }
}
