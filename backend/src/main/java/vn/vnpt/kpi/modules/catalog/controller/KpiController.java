package vn.vnpt.kpi.modules.catalog.controller;

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
import vn.vnpt.kpi.common.excel.ImportService;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.modules.catalog.dto.KpiRequest;
import vn.vnpt.kpi.modules.catalog.model.Kpi;
import vn.vnpt.kpi.modules.catalog.service.KpiImportHandler;
import vn.vnpt.kpi.modules.catalog.service.KpiService;

import java.util.List;
import java.util.Map;

@Tag(name = "Danh mục chỉ tiêu KPI", description = "23.1–25.1")
@RestController
@RequestMapping("/kpis")
@RequiredArgsConstructor
public class KpiController {
    private final KpiService service;
    private final ImportService importService;
    private final KpiImportHandler importHandler;

    @Operation(summary = "23.1/23.2 Danh sách KPI dạng cây (phân trang theo KPI gốc)")
    @GetMapping({"/tree", ""})
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    public ApiResponse<PageResult<Kpi>> tree(@RequestParam(required = false) String keyword, @RequestParam(required = false) Long perspectiveId,
                                             @RequestParam(required = false) Long objectiveId, PageQuery q) {
        return ApiResponse.ok(service.tree(KpiService.filter(keyword, perspectiveId, objectiveId), q));
    }

    @Operation(summary = "Danh sách KPI cho ô chọn (Link KPI tập đoàn, chọn tiêu chí giao, khung KPI chiến lược)")
    @GetMapping("/options")
    @PreAuthorize("hasAnyAuthority('KPI:VIEW','ASSIGN:VIEW','STRATEGY:VIEW','EVAL:VIEW')")
    public ApiResponse<List<Kpi>> options(@RequestParam(required = false) String keyword, @RequestParam(required = false) Long perspectiveId,
                                          @RequestParam(required = false) Long objectiveId, @RequestParam(defaultValue = "false") boolean rootOnly,
                                          @RequestParam(required = false) Long excludeId) {
        return ApiResponse.ok(service.options(keyword, perspectiveId, objectiveId, rootOnly, excludeId));
    }

    @Operation(summary = "Mã tiêu chí tự sinh theo viễn cảnh (xem trước)")
    @GetMapping("/next-code")
    @PreAuthorize("hasAnyAuthority('KPI:CREATE','KPI:UPDATE')")
    public ApiResponse<Map<String, String>> nextCode(@RequestParam Long perspectiveId) {
        return ApiResponse.ok(Map.of("code", service.nextCode(perspectiveId)));
    }

    @Operation(summary = "23.3 Xem chi tiết")
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('KPI:VIEW','ASSIGN:VIEW','EVAL:VIEW')")
    public ApiResponse<Kpi> get(@PathVariable Long id) { return ApiResponse.ok(service.get(id)); }

    @Operation(summary = "24.1 / 25.1 Thêm mới tiêu chí KPI (đơn lẻ / cha – con)")
    @PostMapping
    @PreAuthorize("hasAuthority('KPI:CREATE')")
    public ApiResponse<Kpi> create(@Valid @RequestBody KpiRequest r) { return ApiResponse.ok("Thêm mới thành công", service.create(r)); }

    @Operation(summary = "23.4 Ghi lại")
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('KPI:UPDATE')")
    public ApiResponse<Kpi> update(@PathVariable Long id, @Valid @RequestBody KpiRequest r) { return ApiResponse.ok("Cập nhật thành công", service.update(id, r)); }

    @Operation(summary = "23.5 Xóa (withChildren=true để xóa cả KPI con)")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('KPI:DELETE')")
    public ApiResponse<Void> delete(@PathVariable Long id, @RequestParam(defaultValue = "false") boolean withChildren) {
        service.delete(id, withChildren);
        return ApiResponse.okMessage("Xóa thành công");
    }

    @GetMapping("/import-template")
    @PreAuthorize("hasAuthority('KPI:IMPORT')")
    public ResponseEntity<byte[]> template() { return Downloads.xlsx("Mau_nhap_KPI.xlsx", importService.template(importHandler)); }

    @Operation(summary = "23.6 Nhập dữ liệu — kiểm tra")
    @PostMapping(value = "/import/validate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('KPI:IMPORT')")
    public ApiResponse<ImportService.Preview> validate(@RequestPart("file") MultipartFile f) { return ApiResponse.ok(importService.validate(importHandler, f)); }

    @PostMapping("/import/commit")
    @PreAuthorize("hasAuthority('KPI:IMPORT')")
    public ApiResponse<ImportService.CommitResult> commit(@RequestBody Map<String, String> b) {
        var r = importService.commit(importHandler, b.get("importToken"));
        return ApiResponse.ok(r.message(), r);
    }

    @Operation(summary = "23.7 Xuất dữ liệu (kèm KPI con)")
    @GetMapping("/export")
    @PreAuthorize("hasAuthority('KPI:EXPORT')")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) String keyword, @RequestParam(required = false) Long perspectiveId,
                                         @RequestParam(required = false) Long objectiveId, PageQuery q) {
        return Downloads.xlsx(Strs.exportFileName("DanhSachKPI"), service.export(KpiService.filter(keyword, perspectiveId, objectiveId), q));
    }
}
