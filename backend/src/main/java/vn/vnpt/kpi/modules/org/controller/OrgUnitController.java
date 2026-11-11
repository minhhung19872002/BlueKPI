package vn.vnpt.kpi.modules.org.controller;

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
import vn.vnpt.kpi.modules.org.dto.OrgUnitRequest;
import vn.vnpt.kpi.modules.org.model.OrgUnit;
import vn.vnpt.kpi.modules.org.service.OrgUnitImportHandler;
import vn.vnpt.kpi.modules.org.service.OrgUnitService;

import java.util.List;
import java.util.Map;

@Tag(name = "Đơn vị", description = "5.1–5.8 Quản lý đơn vị/phòng ban")
@RestController
@RequestMapping("/org-units")
@RequiredArgsConstructor
public class OrgUnitController {
    private final OrgUnitService service;
    private final ImportService importService;
    private final OrgUnitImportHandler importHandler;

    @Operation(summary = "5.1/5.2 Danh sách + tìm kiếm")
    @GetMapping
    @PreAuthorize("hasAuthority('ORG:VIEW')")
    public ApiResponse<PageResult<OrgUnit>> list(@RequestParam(required = false) String keyword, @RequestParam(required = false) String unitType,
                                                 @RequestParam(required = false) String regionCode, PageQuery q) {
        return ApiResponse.ok(service.search(OrgUnitService.filter(keyword, unitType, regionCode), q));
    }

    @Operation(summary = "Cây đơn vị (TreeSelect); scope=mine lọc theo phạm vi người dùng")
    @GetMapping("/tree")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<OrgUnit>> tree(@RequestParam(defaultValue = "all") String scope, @RequestParam(defaultValue = "false") boolean assignableOnly) {
        return ApiResponse.ok(service.tree("mine".equals(scope), assignableOnly));
    }

    @Operation(summary = "5.3 Xem chi tiết")
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ORG:VIEW')")
    public ApiResponse<OrgUnit> get(@PathVariable Long id) {
        return ApiResponse.ok(service.get(id));
    }

    @Operation(summary = "5.4 Thêm mới")
    @PostMapping
    @PreAuthorize("hasAuthority('ORG:CREATE')")
    public ApiResponse<OrgUnit> create(@Valid @RequestBody OrgUnitRequest r) {
        return ApiResponse.ok("Thêm mới thành công", service.create(r));
    }

    @Operation(summary = "5.5 Ghi lại")
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ORG:UPDATE')")
    public ApiResponse<OrgUnit> update(@PathVariable Long id, @Valid @RequestBody OrgUnitRequest r) {
        return ApiResponse.ok("Cập nhật thành công", service.update(id, r));
    }

    @Operation(summary = "5.6 Xóa")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ORG:DELETE')")
    public ApiResponse<Void> delete(@PathVariable Long id, @RequestParam(required = false) Integer version) {
        service.delete(id, version);
        return ApiResponse.okMessage("Xóa thành công");
    }

    @GetMapping("/import-template")
    @PreAuthorize("hasAuthority('ORG:IMPORT')")
    public ResponseEntity<byte[]> template() {
        return Downloads.xlsx("Mau_nhap_don_vi.xlsx", importService.template(importHandler));
    }

    @Operation(summary = "5.7 Nhập dữ liệu — kiểm tra")
    @PostMapping(value = "/import/validate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('ORG:IMPORT')")
    public ApiResponse<ImportService.Preview> validate(@RequestPart("file") MultipartFile file) {
        return ApiResponse.ok(importService.validate(importHandler, file));
    }

    @Operation(summary = "5.7 Nhập dữ liệu — xác nhận")
    @PostMapping("/import/commit")
    @PreAuthorize("hasAuthority('ORG:IMPORT')")
    public ApiResponse<ImportService.CommitResult> commit(@RequestBody Map<String, String> body) {
        ImportService.CommitResult r = importService.commit(importHandler, body.get("importToken"));
        return ApiResponse.ok(r.message(), r);
    }

    @Operation(summary = "5.8 Xuất dữ liệu")
    @GetMapping("/export")
    @PreAuthorize("hasAuthority('ORG:EXPORT')")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) String keyword, @RequestParam(required = false) String unitType,
                                         @RequestParam(required = false) String regionCode, PageQuery q) {
        return Downloads.xlsx(Strs.exportFileName("DanhSachDonVi"), service.export(OrgUnitService.filter(keyword, unitType, regionCode), q));
    }
}
