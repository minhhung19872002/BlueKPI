package vn.vnpt.kpi.modules.strategy.controller;

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
import vn.vnpt.kpi.modules.strategy.model.StrategyModels.ObjectiveKpi;
import vn.vnpt.kpi.modules.strategy.model.StrategyModels.Strategy;
import vn.vnpt.kpi.modules.strategy.service.StrategyService;
import vn.vnpt.kpi.security.CurrentUser;
import vn.vnpt.kpi.security.PermissionCodes;

import java.util.List;
import java.util.Map;

@Tag(name = "Quản lý bản đồ chiến lược", description = "36–38")
@RestController
@RequiredArgsConstructor
public class StrategyController {
    private final StrategyService service;

    @Operation(summary = "36.1/36.2 Danh sách chiến lược")
    @GetMapping("/strategies")
    @PreAuthorize("hasAuthority('STRATEGY:VIEW')")
    public ApiResponse<PageResult<Strategy>> search(@RequestParam(required = false) String keyword, @RequestParam(required = false) Long ownerUserId,
                                                    @RequestParam(required = false) Integer fromYear, @RequestParam(required = false) Integer toYear,
                                                    @RequestParam(required = false) String status, @RequestParam(required = false) Long orgUnitId, PageQuery q) {
        return ApiResponse.ok(service.search(service.filter(keyword, ownerUserId, fromYear, toYear, status, orgUnitId), q));
    }

    @Operation(summary = "36.3 Xem chi tiết chiến lược")
    @GetMapping("/strategies/{id}")
    @PreAuthorize("hasAuthority('STRATEGY:VIEW')")
    public ApiResponse<Strategy> get(@PathVariable Long id) { return ApiResponse.ok(service.get(id)); }

    @Operation(summary = "36.4 Thêm chiến lược (tự sinh mã CL-yyyy-NNN)")
    @PostMapping("/strategies")
    @PreAuthorize("hasAuthority('STRATEGY:CREATE')")
    public ApiResponse<Strategy> create(@Valid @RequestBody StrategyService.StrategyRequest r) { return ApiResponse.ok("Thêm mới thành công", service.create(r)); }

    @Operation(summary = "36.5 Cập nhật thông tin chung")
    @PutMapping("/strategies/{id}")
    @PreAuthorize("hasAuthority('STRATEGY:UPDATE')")
    public ApiResponse<Strategy> update(@PathVariable Long id, @Valid @RequestBody StrategyService.StrategyRequest r) {
        return ApiResponse.ok("Cập nhật thành công", service.update(id, r));
    }

    @Operation(summary = "36.6 Xóa chiến lược (cả bản đồ, liên kết, khung KPI)")
    @DeleteMapping("/strategies/{id}")
    @PreAuthorize("hasAuthority('STRATEGY:DELETE')")
    public ApiResponse<Void> delete(@PathVariable Long id, @RequestParam(required = false) Integer version) {
        service.delete(id, version);
        return ApiResponse.ok("Xóa thành công", null);
    }

    @Operation(summary = "36.3/37.x Bản đồ chiến lược")
    @GetMapping("/strategies/{id}/map")
    @PreAuthorize("hasAuthority('STRATEGY:VIEW')")
    public ApiResponse<Map<String, Object>> map(@PathVariable Long id) { return ApiResponse.ok(service.getMap(id)); }

    @Operation(summary = "37.1–37.6, 38.1 Lưu bản đồ: nodes, edges, khung KPI (một transaction)")
    @PutMapping("/strategies/{id}/map")
    @PreAuthorize("hasAuthority('STRATEGY:UPDATE')")
    public ApiResponse<Map<String, Object>> saveMap(@PathVariable Long id, @Valid @RequestBody StrategyService.MapRequest r) {
        var m = service.saveMap(id, r, CurrentUser.current().has(PermissionCodes.STRATEGY_ASSIGN_KPI));
        return ApiResponse.ok((String) m.remove("message"), m);
    }

    @Operation(summary = "37.4 KPI của mục tiêu trọng tâm kèm KH/kết quả kỳ gần nhất")
    @GetMapping("/strategies/{id}/objectives/{objectiveId}/kpis")
    @PreAuthorize("hasAuthority('STRATEGY:VIEW')")
    public ApiResponse<List<ObjectiveKpi>> objectiveKpis(@PathVariable Long id, @PathVariable Long objectiveId, @RequestParam(required = false) Integer year,
                                                         @RequestParam(required = false) String period) {
        return ApiResponse.ok(service.objectiveKpis(id, objectiveId, year, period));
    }
}
