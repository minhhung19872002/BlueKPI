package vn.vnpt.kpi.modules.assignment.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
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
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.modules.assignment.dto.AssignmentDtos;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.ByKpiRow;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.Header;
import vn.vnpt.kpi.modules.assignment.service.AssignmentImportService;
import vn.vnpt.kpi.modules.assignment.service.AssignmentService;

import java.util.List;
import java.util.Map;

@Tag(name = "Giao KPI", description = "29–35")
@RestController
@RequestMapping("/assignments")
@RequiredArgsConstructor
public class AssignmentController {
    private final AssignmentService service;
    private final AssignmentImportService importService;

    // ------------------------------- Theo đơn vị -------------------------------
    @Operation(summary = "29.1/29.2 Danh sách giao KPI theo đơn vị")
    @GetMapping("/by-unit")
    @PreAuthorize("hasAuthority('ASSIGN:VIEW')")
    public ApiResponse<PageResult<Header>> byUnit(@RequestParam(required = false) String keyword, @RequestParam(required = false) Integer year,
                                                  @RequestParam(required = false) String status, PageQuery q) {
        return ApiResponse.ok(service.searchByUnit(service.unitFilter(keyword, year, status), q));
    }

    @Operation(summary = "29.3 Xem chi tiết")
    @GetMapping("/by-unit/{id}")
    @PreAuthorize("hasAuthority('ASSIGN:VIEW')")
    public ApiResponse<Header> getByUnit(@PathVariable Long id) { return ApiResponse.ok(service.getByUnit(id)); }

    @Operation(summary = "30.1 Thêm mới (Đang soạn)")
    @PostMapping("/by-unit")
    @PreAuthorize("hasAuthority('ASSIGN:CREATE')")
    public ApiResponse<AssignmentService.SaveResult> createByUnit(@Valid @RequestBody AssignmentDtos.ByUnitRequest r) {
        return ApiResponse.ok("Thêm mới thành công", service.createByUnit(r));
    }

    @Operation(summary = "30.2 Ghi lại")
    @PutMapping("/by-unit/{id}")
    @PreAuthorize("hasAuthority('ASSIGN:UPDATE')")
    public ApiResponse<AssignmentService.SaveResult> updateByUnit(@PathVariable Long id, @Valid @RequestBody AssignmentDtos.ByUnitRequest r) {
        return ApiResponse.ok("Cập nhật thành công", service.updateByUnit(id, r));
    }

    @Operation(summary = "29.4 Xóa")
    @DeleteMapping("/by-unit/{id}")
    @PreAuthorize("hasAuthority('ASSIGN:DELETE')")
    public ApiResponse<Void> deleteByUnit(@PathVariable Long id) {
        service.deleteByUnit(id);
        return ApiResponse.okMessage("Xóa thành công");
    }

    @GetMapping("/by-unit/{id}/copy-targets")
    @PreAuthorize("hasAuthority('ASSIGN:COPY')")
    public ApiResponse<List<Map<String, Object>>> copyTargets(@PathVariable Long id, @RequestParam Integer targetYear) {
        service.getByUnit(id);
        return ApiResponse.ok(service.copyTargets(targetYear));
    }

    @Operation(summary = "29.5 Sao chép giao KPI theo đơn vị")
    @PostMapping("/by-unit/{id}/copy")
    @PreAuthorize("hasAuthority('ASSIGN:COPY')")
    public ApiResponse<AssignmentService.CopyResult> copyByUnit(@PathVariable Long id, @Valid @RequestBody AssignmentDtos.CopyByUnit r) {
        var res = service.copyByUnit(id, r);
        return ApiResponse.ok(res.message(), res);
    }

    @Operation(summary = "31.1 Chốt số liệu giao KPI theo đơn vị")
    @PostMapping("/by-unit/close")
    @PreAuthorize("hasAuthority('ASSIGN:CLOSE')")
    public ApiResponse<AssignmentService.CloseResult> closeByUnit(@Valid @RequestBody AssignmentDtos.CloseByUnit r) {
        var res = service.closeByUnit(r.ids());
        return ApiResponse.ok(res.message(), res);
    }

    @Operation(summary = "35.2 Xuất dữ liệu (sheet tổng hợp + chi tiết KPI từng đơn vị)")
    @GetMapping("/by-unit/export")
    @PreAuthorize("hasAuthority('ASSIGN:EXPORT')")
    public ResponseEntity<byte[]> exportByUnit(@RequestParam(required = false) String keyword, @RequestParam(required = false) Integer year,
                                               @RequestParam(required = false) String status, PageQuery q) {
        List<Header> headers = service.searchByUnit(service.unitFilter(keyword, year, status), q.forExport()).items();
        return Downloads.xlsx(Strs.exportFileName("GiaoKPITheoDonVi"), importService.export(headers, service.detailsOfHeaders(headers)));
    }

    // ------------------------------- Theo chỉ tiêu -------------------------------
    @Operation(summary = "32.1/32.2 Danh sách giao KPI theo chỉ tiêu")
    @GetMapping("/by-kpi")
    @PreAuthorize("hasAuthority('ASSIGN:VIEW')")
    public ApiResponse<PageResult<ByKpiRow>> byKpi(@RequestParam(required = false) String keyword, @RequestParam(required = false) Integer year,
                                                   @RequestParam(required = false) Long perspectiveId, @RequestParam(required = false) String status, PageQuery q) {
        return ApiResponse.ok(service.searchByKpi(service.kpiFilter(keyword, year, perspectiveId, status), q));
    }

    @Operation(summary = "32.3 Xem chi tiết giao theo chỉ tiêu")
    @GetMapping("/by-kpi/{kpiId}/{year}")
    @PreAuthorize("hasAuthority('ASSIGN:VIEW')")
    public ApiResponse<Map<String, Object>> getByKpi(@PathVariable Long kpiId, @PathVariable int year) { return ApiResponse.ok(service.getByKpi(kpiId, year)); }

    @Operation(summary = "33.1 Thêm mới giao theo chỉ tiêu")
    @PostMapping("/by-kpi")
    @PreAuthorize("hasAuthority('ASSIGN:CREATE')")
    public ApiResponse<Map<String, Object>> createByKpi(@Valid @RequestBody AssignmentDtos.ByKpiRequest r) {
        return ApiResponse.ok("Thêm mới thành công", service.saveByKpi(r, false));
    }

    @Operation(summary = "33.2 Ghi lại giao theo chỉ tiêu")
    @PutMapping("/by-kpi/{kpiId}/{year}")
    @PreAuthorize("hasAuthority('ASSIGN:UPDATE')")
    public ApiResponse<Map<String, Object>> updateByKpi(@PathVariable Long kpiId, @PathVariable int year, @Valid @RequestBody AssignmentDtos.ByKpiRequest r) {
        return ApiResponse.ok("Cập nhật thành công", service.updateByKpi(kpiId, year, r));
    }

    @GetMapping("/by-kpi/copy-sources")
    @PreAuthorize("hasAuthority('ASSIGN:COPY')")
    public ApiResponse<List<Map<String, Object>>> copySources(@RequestParam Long kpiId, @RequestParam int year) { return ApiResponse.ok(service.copySources(kpiId, year)); }

    @Operation(summary = "32.4 Sao chép giao KPI theo chỉ tiêu")
    @PostMapping("/by-kpi/copy")
    @PreAuthorize("hasAuthority('ASSIGN:COPY')")
    public ApiResponse<AssignmentService.CopyResult> copyByKpi(@Valid @RequestBody AssignmentDtos.CopyByKpi r) {
        var res = service.copyByKpi(r);
        return ApiResponse.ok(res.message(), res);
    }

    @Operation(summary = "31.2 Chốt số liệu giao KPI theo chỉ tiêu")
    @PostMapping("/by-kpi/close")
    @PreAuthorize("hasAuthority('ASSIGN:CLOSE')")
    public ApiResponse<AssignmentService.CloseResult> closeByKpi(@Valid @RequestBody AssignmentDtos.CloseByKpi r) {
        var res = service.closeByKpi(r.keys());
        return ApiResponse.ok(res.message(), res);
    }

    // ------------------------------- Điều chỉnh (34) -------------------------------
    @GetMapping("/by-kpi/{kpiId}/{year}/adjustment")
    @PreAuthorize("hasAuthority('ASSIGN:ADJUST')")
    public ApiResponse<Map<String, Object>> adjustment(@PathVariable Long kpiId, @PathVariable int year) { return ApiResponse.ok(service.getAdjustment(kpiId, year)); }

    @Operation(summary = "34.1 Điều chỉnh – Lưu nháp")
    @PostMapping("/by-kpi/{kpiId}/{year}/adjustment/draft")
    @PreAuthorize("hasAuthority('ASSIGN:ADJUST')")
    public ApiResponse<Map<String, Object>> draft(@PathVariable Long kpiId, @PathVariable int year, @Valid @RequestBody AssignmentDtos.AdjustRequest r) {
        return ApiResponse.ok("Lưu nháp thành công", service.saveDraft(kpiId, year, r));
    }

    @Operation(summary = "34.2 Điều chỉnh – Lưu chốt")
    @PostMapping("/by-kpi/{kpiId}/{year}/adjustment/commit")
    @PreAuthorize("hasAuthority('ASSIGN:ADJUST')")
    public ApiResponse<Map<String, Object>> commit(@PathVariable Long kpiId, @PathVariable int year, @Valid @RequestBody AssignmentDtos.AdjustRequest r) {
        return ApiResponse.ok("Lưu chốt điều chỉnh thành công", service.commitAdjustment(kpiId, year, r));
    }

    @Operation(summary = "34.3 Xem lịch sử điều chỉnh")
    @GetMapping("/details/{detailId}/history")
    @PreAuthorize("hasAuthority('ASSIGN:VIEW')")
    public ApiResponse<List<?>> history(@PathVariable Long detailId) { return ApiResponse.ok(service.history(detailId)); }

    // ------------------------------- Nhập dữ liệu (35.1) -------------------------------
    @GetMapping("/import-template")
    @PreAuthorize("hasAuthority('ASSIGN:IMPORT')")
    public ResponseEntity<byte[]> template(@RequestParam(defaultValue = "unit") String mode) {
        return Downloads.xlsx("kpi".equals(mode) ? "Mau_giao_KPI_theo_chi_tieu.xlsx" : "Mau_giao_KPI_theo_don_vi.xlsx", importService.template(mode));
    }

    @Operation(summary = "35.1 Nhập dữ liệu lên màn hình nhập giao (chưa lưu DB)")
    @PostMapping(value = "/import/parse", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('ASSIGN:IMPORT')")
    public ApiResponse<Map<String, Object>> parse(@RequestParam(defaultValue = "unit") String mode, @RequestPart("file") MultipartFile file) {
        Map<String, Object> m = importService.parse(mode, file);
        return ApiResponse.ok((String) m.get("message"), m);
    }
}
