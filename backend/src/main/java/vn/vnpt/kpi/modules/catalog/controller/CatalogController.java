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
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Objective;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Perspective;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.ScoringMethod;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Stage;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Uom;
import vn.vnpt.kpi.modules.catalog.service.CatalogImportHandlers;
import vn.vnpt.kpi.modules.catalog.service.CatalogService;

import java.util.List;
import java.util.Map;

@Tag(name = "Danh mục KPI", description = "Đơn vị đo, Viễn cảnh, Mục tiêu trọng tâm, Phương pháp tính điểm, Giai đoạn")
@RestController
@RequiredArgsConstructor
public class CatalogController {
    private final CatalogService service;
    private final ImportService importService;
    private final CatalogImportHandlers.UomImport uomImport;
    private final CatalogImportHandlers.PerspectiveImport perspectiveImport;
    private final CatalogImportHandlers.ObjectiveImport objectiveImport;

    // ---------------- Đơn vị đo (26.1–26.8) ----------------
    @Operation(summary = "26.1/26.2 Danh sách đơn vị đo")
    @GetMapping("/uoms")
    @PreAuthorize("hasAnyAuthority('UOM:VIEW','KPI:VIEW')")
    public ApiResponse<PageResult<Uom>> uoms(@RequestParam(required = false) String keyword, @RequestParam(required = false) String status, PageQuery q) {
        return ApiResponse.ok(service.searchUom(keyword, status, q));
    }

    @GetMapping("/uoms/{id}")
    @PreAuthorize("hasAuthority('UOM:VIEW')")
    public ApiResponse<Uom> uom(@PathVariable Long id) { return ApiResponse.ok(service.getUom(id)); }

    @PostMapping("/uoms")
    @PreAuthorize("hasAuthority('UOM:CREATE')")
    public ApiResponse<Uom> createUom(@Valid @RequestBody CatalogService.UomRequest r) { return ApiResponse.ok("Thêm mới thành công", service.createUom(r)); }

    @PutMapping("/uoms/{id}")
    @PreAuthorize("hasAuthority('UOM:UPDATE')")
    public ApiResponse<Uom> updateUom(@PathVariable Long id, @Valid @RequestBody CatalogService.UomRequest r) { return ApiResponse.ok("Cập nhật thành công", service.updateUom(id, r)); }

    @DeleteMapping("/uoms/{id}")
    @PreAuthorize("hasAuthority('UOM:DELETE')")
    public ApiResponse<Void> deleteUom(@PathVariable Long id, @RequestParam(required = false) Integer version) {
        service.deleteUom(id, version);
        return ApiResponse.okMessage("Xóa thành công");
    }

    @GetMapping("/uoms/import-template")
    @PreAuthorize("hasAuthority('UOM:IMPORT')")
    public ResponseEntity<byte[]> uomTemplate() { return Downloads.xlsx("Mau_nhap_don_vi_do.xlsx", importService.template(uomImport)); }

    @PostMapping(value = "/uoms/import/validate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('UOM:IMPORT')")
    public ApiResponse<ImportService.Preview> uomValidate(@RequestPart("file") MultipartFile f) { return ApiResponse.ok(importService.validate(uomImport, f)); }

    @PostMapping("/uoms/import/commit")
    @PreAuthorize("hasAuthority('UOM:IMPORT')")
    public ApiResponse<ImportService.CommitResult> uomCommit(@RequestBody Map<String, String> b) {
        var r = importService.commit(uomImport, b.get("importToken"));
        return ApiResponse.ok(r.message(), r);
    }

    @GetMapping("/uoms/export")
    @PreAuthorize("hasAuthority('UOM:EXPORT')")
    public ResponseEntity<byte[]> uomExport(@RequestParam(required = false) String keyword, @RequestParam(required = false) String status, PageQuery q) {
        return Downloads.xlsx(Strs.exportFileName("DanhSachDonViDo"), service.exportUom(keyword, status, q));
    }

    // ---------------- Viễn cảnh (26.9–26.16) ----------------
    @Operation(summary = "26.9/26.10 Danh sách viễn cảnh")
    @GetMapping("/perspectives")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<PageResult<Perspective>> perspectives(@RequestParam(required = false) String keyword, @RequestParam(required = false) String status, PageQuery q) {
        return ApiResponse.ok(service.searchPerspective(keyword, status, q));
    }

    @GetMapping("/perspectives/all")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<Perspective>> allPerspectives() { return ApiResponse.ok(service.allPerspectives()); }

    @GetMapping("/perspectives/{id}")
    @PreAuthorize("hasAuthority('PERSPECTIVE:VIEW')")
    public ApiResponse<Perspective> perspective(@PathVariable Long id) { return ApiResponse.ok(service.getPerspective(id)); }

    @PostMapping("/perspectives")
    @PreAuthorize("hasAuthority('PERSPECTIVE:CREATE')")
    public ApiResponse<Perspective> createPerspective(@Valid @RequestBody CatalogService.PerspectiveRequest r) { return ApiResponse.ok("Thêm mới thành công", service.createPerspective(r)); }

    @PutMapping("/perspectives/{id}")
    @PreAuthorize("hasAuthority('PERSPECTIVE:UPDATE')")
    public ApiResponse<Perspective> updatePerspective(@PathVariable Long id, @Valid @RequestBody CatalogService.PerspectiveRequest r) {
        return ApiResponse.ok("Cập nhật thành công", service.updatePerspective(id, r));
    }

    @DeleteMapping("/perspectives/{id}")
    @PreAuthorize("hasAuthority('PERSPECTIVE:DELETE')")
    public ApiResponse<Void> deletePerspective(@PathVariable Long id, @RequestParam(required = false) Integer version) {
        service.deletePerspective(id, version);
        return ApiResponse.okMessage("Xóa thành công");
    }

    @GetMapping("/perspectives/import-template")
    @PreAuthorize("hasAuthority('PERSPECTIVE:IMPORT')")
    public ResponseEntity<byte[]> perTemplate() { return Downloads.xlsx("Mau_nhap_vien_canh.xlsx", importService.template(perspectiveImport)); }

    @PostMapping(value = "/perspectives/import/validate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PERSPECTIVE:IMPORT')")
    public ApiResponse<ImportService.Preview> perValidate(@RequestPart("file") MultipartFile f) { return ApiResponse.ok(importService.validate(perspectiveImport, f)); }

    @PostMapping("/perspectives/import/commit")
    @PreAuthorize("hasAuthority('PERSPECTIVE:IMPORT')")
    public ApiResponse<ImportService.CommitResult> perCommit(@RequestBody Map<String, String> b) {
        var r = importService.commit(perspectiveImport, b.get("importToken"));
        return ApiResponse.ok(r.message(), r);
    }

    @GetMapping("/perspectives/export")
    @PreAuthorize("hasAuthority('PERSPECTIVE:EXPORT')")
    public ResponseEntity<byte[]> perExport(@RequestParam(required = false) String keyword, @RequestParam(required = false) String status, PageQuery q) {
        return Downloads.xlsx(Strs.exportFileName("DanhSachVienCanh"), service.exportPerspective(keyword, status, q));
    }

    // ---------------- Mục tiêu trọng tâm (28.1–28.8) ----------------
    @Operation(summary = "28.1/28.2 Danh sách mục tiêu trọng tâm")
    @GetMapping("/objectives")
    @PreAuthorize("hasAnyAuthority('OBJECTIVE:VIEW','KPI:VIEW','STRATEGY:VIEW')")
    public ApiResponse<PageResult<Objective>> objectives(@RequestParam(required = false) String keyword, @RequestParam(required = false) Long perspectiveId,
                                                         PageQuery q) {
        return ApiResponse.ok(service.searchObjective(keyword, perspectiveId, null, null, q));
    }

    @Operation(summary = "37.1 Tìm kiếm mục tiêu trọng tâm đặt vào chiến lược (đánh dấu đã có trên bản đồ)")
    @GetMapping("/objectives/search-for-strategy")
    @PreAuthorize("hasAnyAuthority('STRATEGY:UPDATE','STRATEGY:VIEW')")
    public ApiResponse<PageResult<Objective>> searchForStrategy(@RequestParam(required = false) String keyword, @RequestParam(required = false) Long perspectiveId,
                                                                @RequestParam(required = false) Long strategyId, PageQuery q) {
        return ApiResponse.ok(service.searchObjective(keyword, perspectiveId, "HIEU_LUC", strategyId, q));
    }

    @GetMapping("/objectives/{id}")
    @PreAuthorize("hasAuthority('OBJECTIVE:VIEW')")
    public ApiResponse<Objective> objective(@PathVariable Long id) { return ApiResponse.ok(service.getObjective(id)); }

    @PostMapping("/objectives")
    @PreAuthorize("hasAuthority('OBJECTIVE:CREATE')")
    public ApiResponse<Objective> createObjective(@Valid @RequestBody CatalogService.ObjectiveRequest r) { return ApiResponse.ok("Thêm mới thành công", service.createObjective(r)); }

    @PutMapping("/objectives/{id}")
    @PreAuthorize("hasAuthority('OBJECTIVE:UPDATE')")
    public ApiResponse<Objective> updateObjective(@PathVariable Long id, @Valid @RequestBody CatalogService.ObjectiveRequest r) {
        return ApiResponse.ok("Cập nhật thành công", service.updateObjective(id, r));
    }

    @DeleteMapping("/objectives/{id}")
    @PreAuthorize("hasAuthority('OBJECTIVE:DELETE')")
    public ApiResponse<Void> deleteObjective(@PathVariable Long id, @RequestParam(required = false) Integer version) {
        service.deleteObjective(id, version);
        return ApiResponse.okMessage("Xóa thành công");
    }

    @GetMapping("/objectives/import-template")
    @PreAuthorize("hasAuthority('OBJECTIVE:IMPORT')")
    public ResponseEntity<byte[]> objTemplate() { return Downloads.xlsx("Mau_nhap_muc_tieu_trong_tam.xlsx", importService.template(objectiveImport)); }

    @PostMapping(value = "/objectives/import/validate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('OBJECTIVE:IMPORT')")
    public ApiResponse<ImportService.Preview> objValidate(@RequestPart("file") MultipartFile f) { return ApiResponse.ok(importService.validate(objectiveImport, f)); }

    @PostMapping("/objectives/import/commit")
    @PreAuthorize("hasAuthority('OBJECTIVE:IMPORT')")
    public ApiResponse<ImportService.CommitResult> objCommit(@RequestBody Map<String, String> b) {
        var r = importService.commit(objectiveImport, b.get("importToken"));
        return ApiResponse.ok(r.message(), r);
    }

    @GetMapping("/objectives/export")
    @PreAuthorize("hasAuthority('OBJECTIVE:EXPORT')")
    public ResponseEntity<byte[]> objExport(@RequestParam(required = false) String keyword, @RequestParam(required = false) Long perspectiveId, PageQuery q) {
        return Downloads.xlsx(Strs.exportFileName("DanhSachMucTieuTrongTam"), service.exportObjective(keyword, perspectiveId, q));
    }

    // ---------------- Phương pháp tính điểm / Giai đoạn ----------------
    @GetMapping("/scoring-methods")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<ScoringMethod>> scoringMethods() { return ApiResponse.ok(service.scoringMethods()); }

    @GetMapping("/stages")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<Stage>> stages() { return ApiResponse.ok(service.stages()); }

    @PostMapping("/stages")
    @PreAuthorize("hasAuthority('SYSCONFIG:CREATE')")
    public ApiResponse<Stage> createStage(@Valid @RequestBody CatalogService.StageRequest r) { return ApiResponse.ok("Thêm mới thành công", service.createStage(r)); }

    @PutMapping("/stages/{id}")
    @PreAuthorize("hasAuthority('SYSCONFIG:UPDATE')")
    public ApiResponse<Stage> updateStage(@PathVariable Long id, @Valid @RequestBody CatalogService.StageRequest r) { return ApiResponse.ok("Cập nhật thành công", service.updateStage(id, r)); }

    @DeleteMapping("/stages/{id}")
    @PreAuthorize("hasAuthority('SYSCONFIG:DELETE')")
    public ApiResponse<Void> deleteStage(@PathVariable Long id) {
        service.deleteStage(id);
        return ApiResponse.okMessage("Xóa thành công");
    }
}
