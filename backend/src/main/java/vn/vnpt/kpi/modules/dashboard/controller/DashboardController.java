package vn.vnpt.kpi.modules.dashboard.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vnpt.kpi.common.ApiResponse;
import vn.vnpt.kpi.common.excel.Downloads;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.modules.dashboard.service.DashboardService;

import java.util.List;
import java.util.Map;

/** Dashboard TGĐ BSC — tham số unit = GROUP | PROVINCES | id; period = Q1..Q4 | H1 | Y | GD:&lt;id&gt; */
@Tag(name = "Dashboard TGĐ BSC", description = "6–17")
@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {
    static final String ANY_VIEW = "hasAnyAuthority('DASHBOARD:VIEW_GROUP','DASHBOARD:VIEW_UNIT','DASHBOARD:VIEW_PROVINCE')";
    private final DashboardService service;

    @Operation(summary = "17.1 Bộ lọc + giá trị mặc định")
    @GetMapping("/filters")
    @PreAuthorize(ANY_VIEW)
    public ApiResponse<Map<String, Object>> filters() { return ApiResponse.ok(service.filters()); }

    @Operation(summary = "6–14, 17.2 Tổng quan: thẻ thống kê, Điểm BSC tổng hợp, Chỉ đạo trọng tâm")
    @GetMapping("/overview")
    @PreAuthorize(ANY_VIEW)
    public ApiResponse<Map<String, Object>> overview(@RequestParam(required = false) String unit, @RequestParam(required = false) Integer year,
                                                     @RequestParam(required = false) String period) {
        return ApiResponse.ok(service.overview(service.resolve(unit, year, period)));
    }

    @Operation(summary = "6.1 / 12.1 Bảng xếp hạng điểm BSC khối VNPT tỉnh/thành phố")
    @GetMapping("/ranking-provinces")
    @PreAuthorize("hasAnyAuthority('DASHBOARD:VIEW_GROUP','DASHBOARD:VIEW_PROVINCE')")
    public ApiResponse<Map<String, Object>> ranking(@RequestParam(required = false) Integer year, @RequestParam(required = false) String period,
                                                    @RequestParam(defaultValue = "false") boolean all) {
        return ApiResponse.ok(service.rankingProvinces(service.resolve(DashboardService.PROVINCES, year, period), all));
    }

    @Operation(summary = "6.1 Điểm BSC các Tổng công ty/Công ty")
    @GetMapping("/corporations")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW_GROUP')")
    public ApiResponse<List<Map<String, Object>>> corporations(@RequestParam(required = false) Integer year, @RequestParam(required = false) String period) {
        return ApiResponse.ok(service.corporations(service.resolve(DashboardService.GROUP, year, period)));
    }

    @Operation(summary = "17.7 Bảng tổng hợp kết quả các KPI giao cho Tổng công ty/Công ty")
    @GetMapping("/corporations/{unitId}/table")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW_GROUP')")
    public ApiResponse<Map<String, Object>> corporationTable(@PathVariable Long unitId, @RequestParam(required = false) Integer year, @RequestParam(required = false) String period) {
        return ApiResponse.ok(service.corporationTable(service.resolve(DashboardService.GROUP, year, period), unitId));
    }

    @Operation(summary = "17.8 Xuất bảng tổng hợp kết quả KPI giao cho Tổng công ty/Công ty")
    @GetMapping("/corporations/{unitId}/table/export")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW_GROUP') and hasAuthority('DASHBOARD:EXPORT')")
    public ResponseEntity<byte[]> corporationTableExport(@PathVariable Long unitId, @RequestParam(required = false) Integer year, @RequestParam(required = false) String period) {
        return Downloads.xlsx(Strs.exportFileName("BangTongHopKPI_TCT"), service.corporationTableExcel(service.resolve(DashboardService.GROUP, year, period), unitId));
    }

    @Operation(summary = "17.3 / 17.4 Danh sách chi tiết các KPI (card = ALL|ACHIEVED|NOT_ACHIEVED|TRACKING|FOCUS)")
    @GetMapping("/kpi-list")
    @PreAuthorize(ANY_VIEW)
    public ApiResponse<List<Map<String, Object>>> kpiList(@RequestParam(required = false) String unit, @RequestParam(required = false) Integer year,
                                                          @RequestParam(required = false) String period, @RequestParam(required = false) String card,
                                                          @RequestParam(required = false) String keyword, @RequestParam(required = false) Long perspectiveId) {
        return ApiResponse.ok(service.kpiList(service.resolve(unit, year, period), card, keyword, perspectiveId));
    }

    @Operation(summary = "Chỉ đạo trọng tâm: các KPI is_focus")
    @GetMapping("/focus-kpis")
    @PreAuthorize(ANY_VIEW)
    public ApiResponse<List<Map<String, Object>>> focus(@RequestParam(required = false) String unit, @RequestParam(required = false) Integer year,
                                                        @RequestParam(required = false) String period) {
        return ApiResponse.ok(service.kpis(service.resolve(unit, year, period), true, null));
    }

    @Operation(summary = "17.5 Chi tiết KPI trọng tâm + phân rã các đơn vị con")
    @GetMapping("/focus-kpis/{kpiId}/breakdown")
    @PreAuthorize(ANY_VIEW)
    public ApiResponse<Map<String, Object>> breakdown(@PathVariable Long kpiId, @RequestParam(required = false) String unit, @RequestParam(required = false) Integer year,
                                                      @RequestParam(required = false) String period) {
        return ApiResponse.ok(service.breakdown(service.resolve(unit, year, period), kpiId));
    }

    @Operation(summary = "14.1 Một tỉnh qua các kỳ đánh giá trong giai đoạn")
    @GetMapping("/province-stage")
    @PreAuthorize(ANY_VIEW)
    public ApiResponse<List<Map<String, Object>>> provinceStage(@RequestParam Long unitId, @RequestParam Long stageId) {
        return ApiResponse.ok(service.provinceStage(unitId, stageId));
    }

    @Operation(summary = "17.6 Xuất kết quả đánh giá KPI (sheet 1 tổng hợp, sheet 2 chi tiết KPI)")
    @GetMapping("/export-results")
    @PreAuthorize("hasAuthority('DASHBOARD:EXPORT')")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) String unit, @RequestParam(required = false) Integer year, @RequestParam(required = false) String period) {
        return Downloads.xlsx(Strs.exportFileName("KetQuaDanhGiaKPI"), service.exportResults(service.resolve(unit, year, period)));
    }

    @Operation(summary = "15.1 Bản đồ chiến lược (chỉ đọc) của đơn vị theo năm/giai đoạn")
    @GetMapping("/strategy-map")
    @PreAuthorize(ANY_VIEW)
    public ApiResponse<Map<String, Object>> strategyMap(@RequestParam(required = false) String unit, @RequestParam(required = false) Integer year,
                                                        @RequestParam(required = false) String period) {
        return ApiResponse.ok(service.strategyMap(service.resolve(unit, year, period)));
    }
}
