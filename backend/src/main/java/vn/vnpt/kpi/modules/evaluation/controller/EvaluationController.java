package vn.vnpt.kpi.modules.evaluation.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import vn.vnpt.kpi.common.ApiResponse;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.common.excel.Downloads;
import vn.vnpt.kpi.common.util.Jsons;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.EvalKpi;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.Result;
import vn.vnpt.kpi.modules.evaluation.service.EvaluationService;
import vn.vnpt.kpi.modules.evaluation.service.SyncService;
import vn.vnpt.kpi.security.PermissionCodes;

import java.util.List;
import java.util.Map;

@Tag(name = "Đánh giá KPI", description = "39–44, 49.1")
@RestController
@RequestMapping("/evaluations")
@RequiredArgsConstructor
public class EvaluationController {
    private final EvaluationService service;
    private final SyncService sync;

    @Operation(summary = "39.1/39.2 Tổng hợp BSC theo chỉ tiêu KPI")
    @GetMapping("/by-kpi")
    @PreAuthorize("hasAuthority('EVAL:VIEW')")
    public ApiResponse<PageResult<EvalKpi>> byKpi(@RequestParam(required = false) String keyword, @RequestParam(required = false) Integer year,
                                                  @RequestParam(required = false) String period, @RequestParam(required = false) Long perspectiveId,
                                                  @RequestParam(required = false) String status, @RequestParam(required = false) String resultType, PageQuery q) {
        return ApiResponse.ok(service.searchByKpi(service.filter(keyword, year, period, perspectiveId, status, resultType), q));
    }

    @Operation(summary = "39.3 Thông tin chung KPI-kỳ")
    @GetMapping("/by-kpi/{id}")
    @PreAuthorize("hasAuthority('EVAL:VIEW')")
    public ApiResponse<Map<String, Object>> header(@PathVariable Long id) { return ApiResponse.ok(service.header(id)); }

    @Operation(summary = "Danh sách đơn vị được giao (lưới đánh giá)")
    @GetMapping("/{id}/results")
    @PreAuthorize("hasAuthority('EVAL:VIEW')")
    public ApiResponse<List<Result>> results(@PathVariable Long id, @RequestParam(required = false) String keyword, @RequestParam(required = false) String rating) {
        return ApiResponse.ok(service.results(id, keyword, rating));
    }

    @Operation(summary = "43.1 Đồng bộ lại")
    @PostMapping("/{id}/sync")
    @PreAuthorize("hasAuthority('EVAL:SYNC')")
    public ApiResponse<SyncService.SyncOutcome> sync(@PathVariable Long id) {
        var o = sync.syncEvalKpi(id, "USER");
        return ApiResponse.ok(o.message(), o);
    }

    @GetMapping("/sync-batches/{batchId}")
    @PreAuthorize("hasAuthority('EVAL:VIEW')")
    public ApiResponse<Map<String, Object>> batch(@PathVariable Long batchId) { return ApiResponse.ok(sync.batch(batchId)); }

    @Operation(summary = "44.1 Lưu kết quả nhập tay")
    @PutMapping("/{id}/results")
    @PreAuthorize("hasAuthority('EVAL:INPUT')")
    public ApiResponse<List<Result>> save(@PathVariable Long id, @RequestBody EvaluationService.SaveRows body) {
        return ApiResponse.ok("Lưu kết quả thành công", service.saveResults(id, body));
    }

    @Operation(summary = "Tính thử Kết quả cuối / Điểm / Đánh giá (không lưu)")
    @PostMapping("/{id}/calculate-preview")
    @PreAuthorize("hasAuthority('EVAL:VIEW')")
    public ApiResponse<List<Map<String, Object>>> preview(@PathVariable Long id, @RequestBody EvaluationService.SaveRows body) {
        return ApiResponse.ok(service.preview(id, body));
    }

    @GetMapping("/{id}/manual-template")
    @PreAuthorize("hasAuthority('EVAL:IMPORT')")
    public ResponseEntity<byte[]> template(@PathVariable Long id, @RequestParam Long componentId) {
        return Downloads.xlsx("Mau_nhap_tay_KPI.xlsx", service.manualTemplate(id, componentId));
    }

    @Operation(summary = "44.2 Nhập dữ liệu nhập tay từ file")
    @PostMapping(value = "/{id}/manual-import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('EVAL:IMPORT')")
    public ApiResponse<Map<String, Object>> manualImport(@PathVariable Long id, @RequestParam Long componentId, @RequestPart("file") MultipartFile file) {
        var m = service.manualImport(id, componentId, file);
        return ApiResponse.ok((String) m.get("message"), m);
    }

    @Operation(summary = "49.1 Chốt kết quả R2")
    @PostMapping("/{id}/close-r2")
    @PreAuthorize("hasAuthority('EVAL:CLOSE_R2')")
    public ApiResponse<EvalKpi> closeR2(@PathVariable Long id) { return ApiResponse.ok("Chốt kết quả R2 thành công", service.closeR2(id)); }

    // -------------------- Theo dõi kết quả thẩm định và phản hồi --------------------
    @Operation(summary = "40.1/40.2 Theo dõi kết quả thẩm định và phản hồi")
    @GetMapping("/review")
    @PreAuthorize("hasAuthority('EVAL:VIEW')")
    public ApiResponse<PageResult<Result>> review(@RequestParam(required = false) String keyword, @RequestParam(required = false) Integer year,
                                                  @RequestParam(required = false) String period, @RequestParam(required = false) String status, PageQuery q) {
        return ApiResponse.ok(service.review(service.reviewFilter(keyword, year, period, status, null), PermissionCodes.EVAL_VIEW, q));
    }

    @Operation(summary = "40.3 Xem chi tiết")
    @GetMapping("/results/{id}")
    @PreAuthorize("hasAnyAuthority('EVAL:VIEW','BSC:VIEW')")
    public ApiResponse<Map<String, Object>> result(@PathVariable Long id) {
        return ApiResponse.ok(service.resultDetail(id, PermissionCodes.EVAL_VIEW));
    }

    @Operation(summary = "41.1 Điều chỉnh kết quả KPI cho đơn vị (multipart: data JSON + decisionFile)")
    @PutMapping(value = "/results/{id}/adjust", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('EVAL:ADJUST')")
    public ApiResponse<Map<String, Object>> adjust(@PathVariable Long id, @RequestPart("data") String data,
                                                   @RequestPart(value = "decisionFile", required = false) MultipartFile decisionFile) {
        return ApiResponse.ok("Điều chỉnh kết quả thành công", service.adjust(id, Jsons.fromJson(data, EvaluationService.AdjustInput.class), decisionFile));
    }

    @Operation(summary = "42.1 Cập nhật kết quả đánh giá KPI (SL nhập tay) cho đơn vị")
    @PutMapping("/results/{id}/manual")
    @PreAuthorize("hasAuthority('EVAL:INPUT')")
    public ApiResponse<Map<String, Object>> manual(@PathVariable Long id, @RequestBody EvaluationService.AdjustInput in) {
        return ApiResponse.ok("Cập nhật kết quả thành công", service.manual(id, in));
    }
}
