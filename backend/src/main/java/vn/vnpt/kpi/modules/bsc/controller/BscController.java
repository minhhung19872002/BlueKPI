package vn.vnpt.kpi.modules.bsc.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vnpt.kpi.common.ApiResponse;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.common.excel.Downloads;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.modules.bsc.service.BscService;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.Result;
import vn.vnpt.kpi.modules.report.service.ReportService;

import java.util.Map;

@Tag(name = "Tổng hợp kết quả BSC", description = "45–53")
@RestController
@RequiredArgsConstructor
public class BscController {
    private final BscService service;
    private final ReportService reports;

    public record IdBody(Long evalKpiId, Long resultId) {}

    @Operation(summary = "46.1/46.2 Tổng hợp kết quả BSC")
    @GetMapping("/bsc/summary")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ApiResponse<PageResult<Result>> summary(@RequestParam(required = false) String keyword, @RequestParam(required = false) Integer year,
                                                   @RequestParam(required = false) String period, @RequestParam(required = false) Long perspectiveId,
                                                   @RequestParam(required = false) String status, @RequestParam(required = false) String dataType, PageQuery q) {
        return ApiResponse.ok(service.list(service.filter(keyword, year, period, perspectiveId, status, dataType), q));
    }

    @Operation(summary = "46.3 Xem theo đơn vị")
    @GetMapping("/bsc/summary/by-unit")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ApiResponse<Map<String, Object>> byUnit(@RequestParam Long unitId, @RequestParam int year, @RequestParam String period) {
        return ApiResponse.ok(service.byUnit(unitId, year, period));
    }

    @Operation(summary = "46.3 Xem theo KPI")
    @GetMapping("/bsc/summary/by-kpi")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ApiResponse<Map<String, Object>> byKpi(@RequestParam Long evalKpiId) { return ApiResponse.ok(service.byKpi(evalKpiId)); }

    @Operation(summary = "46.4 Thu hồi kết quả đánh giá (tiêu chí × kỳ)")
    @PostMapping("/bsc/revoke")
    @PreAuthorize("hasAuthority('BSC:REVOKE')")
    public ApiResponse<Map<String, Object>> revoke(@RequestBody IdBody b) {
        var m = service.revoke(b.evalKpiId());
        return ApiResponse.ok((String) m.get("message"), m);
    }

    @Operation(summary = "47.4 Thu hồi kết quả đánh giá theo đơn vị")
    @PostMapping("/bsc/revoke-unit")
    @PreAuthorize("hasAuthority('BSC:REVOKE')")
    public ApiResponse<Map<String, Object>> revokeUnit(@RequestBody IdBody b) {
        var m = service.revokeUnit(b.resultId());
        return ApiResponse.ok((String) m.get("message"), m);
    }

    @Operation(summary = "46.5 Tính lại điểm đánh giá")
    @PostMapping("/bsc/recalculate")
    @PreAuthorize("hasAuthority('BSC:RECALC')")
    public ApiResponse<Map<String, Object>> recalc(@RequestBody BscService.YearPeriod p) {
        var m = service.recalculate(p);
        return ApiResponse.ok((String) m.get("message"), m);
    }

    @Operation(summary = "48.x Chốt đánh giá KPI → 200 hoặc 409 kèm danh sách đơn vị chưa đủ điều kiện")
    @PostMapping("/bsc/close")
    @PreAuthorize("hasAuthority('BSC:CLOSE')")
    public ApiResponse<Map<String, Object>> close(@RequestBody BscService.YearPeriod p) {
        var m = service.close(p);
        return ApiResponse.ok((String) m.get("message"), m);
    }

    @Operation(summary = "50.x Kiểm tra điều kiện Tổng giám đốc duyệt")
    @PostMapping("/bsc/approve/check")
    @PreAuthorize("hasAuthority('BSC:APPROVE')")
    public ApiResponse<Map<String, Object>> approveCheck(@RequestBody BscService.YearPeriod p) { return ApiResponse.ok(service.approveCheck(p)); }

    @Operation(summary = "50.2/50.4 Ký duyệt")
    @PostMapping("/bsc/approve")
    @PreAuthorize("hasAuthority('BSC:APPROVE')")
    public ApiResponse<Map<String, Object>> approve(@RequestBody BscService.YearPeriod p) {
        var m = service.approve(p);
        return ApiResponse.ok((String) m.get("message"), m);
    }

    @Operation(summary = "47.1/47.2 Theo dõi kết quả thẩm định và phản hồi (Tổng hợp BSC)")
    @GetMapping("/bsc/review")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ApiResponse<PageResult<Result>> review(@RequestParam(required = false) String keyword, @RequestParam(required = false) Integer year,
                                                  @RequestParam(required = false) String period, @RequestParam(required = false) String status, PageQuery q) {
        return ApiResponse.ok(service.review(keyword, year, period, status, q));
    }

    @Operation(summary = "47.3 Xem chi tiết")
    @GetMapping("/bsc/results/{id}")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ApiResponse<Map<String, Object>> result(@PathVariable Long id) { return ApiResponse.ok(service.resultDetail(id)); }

    // ------------------------------- Báo cáo -------------------------------
    @Operation(summary = "51–53 Xuất báo cáo theo mẫu (TTR94_TONG_HOP, TTR94_CHI_TIET, KPI_TUNG_TINH)")
    @PostMapping("/reports/{templateCode}")
    @PreAuthorize("hasAuthority('BSC:REPORT')")
    public ResponseEntity<byte[]> report(@PathVariable String templateCode, @RequestBody ReportService.ReportRequest r) {
        return Downloads.xlsx(Strs.exportFileName(ReportService.fileName(templateCode)), reports.render(templateCode, r));
    }

    @Operation(summary = "45.1 Xuất biểu giao KPI")
    @GetMapping("/reports/assignment-sheet")
    @PreAuthorize("hasAuthority('BSC:REPORT')")
    public ResponseEntity<byte[]> assignmentSheet(@RequestParam Long unitId, @RequestParam int year) {
        return Downloads.xlsx(Strs.exportFileName("BieuGiaoKPI"), reports.assignmentSheet(unitId, year));
    }

    @Operation(summary = "45.2 Xuất biểu kết quả KPI")
    @GetMapping("/reports/result-sheet")
    @PreAuthorize("hasAuthority('BSC:REPORT')")
    public ResponseEntity<byte[]> resultSheet(@RequestParam Long unitId, @RequestParam int year, @RequestParam String period) {
        return Downloads.xlsx(Strs.exportFileName("BieuKetQuaKPI"), reports.resultSheet(unitId, year, period));
    }
}
