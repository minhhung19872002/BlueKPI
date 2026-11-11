package vn.vnpt.kpi.modules.user.controller;

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
import vn.vnpt.kpi.modules.user.dto.UserRequest;
import vn.vnpt.kpi.modules.user.model.AppUser;
import vn.vnpt.kpi.modules.user.service.UserImportHandler;
import vn.vnpt.kpi.modules.user.service.UserService;

import java.util.List;
import java.util.Map;

@Tag(name = "Người dùng", description = "3.1–3.10")
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService service;
    private final ImportService importService;
    private final UserImportHandler importHandler;

    @Operation(summary = "3.1/3.2 Danh sách + tìm kiếm (đơn vị gồm cả đơn vị con)")
    @GetMapping
    @PreAuthorize("hasAuthority('USER:VIEW')")
    public ApiResponse<PageResult<AppUser>> list(@RequestParam(required = false) String keyword, @RequestParam(required = false) String status,
                                                 @RequestParam(required = false) Long orgUnitId, PageQuery q) {
        return ApiResponse.ok(service.search(service.filter(keyword, status, orgUnitId), q));
    }

    @Operation(summary = "Danh sách người dùng cho ô chọn (Cán bộ giao/đánh giá, Chủ trì)")
    @GetMapping("/options")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<Map<String, Object>>> options(@RequestParam(required = false) Long orgUnitId,
                                                          @RequestParam(defaultValue = "false") boolean includeChildren,
                                                          @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(service.options(orgUnitId, includeChildren, keyword));
    }

    @Operation(summary = "3.3 Xem chi tiết (kèm vai trò đã gán)")
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('USER:VIEW')")
    public ApiResponse<AppUser> get(@PathVariable Long id) {
        return ApiResponse.ok(service.get(id));
    }

    @Operation(summary = "3.4 Thêm mới")
    @PostMapping
    @PreAuthorize("hasAuthority('USER:CREATE')")
    public ApiResponse<AppUser> create(@Valid @RequestBody UserRequest r) {
        return ApiResponse.ok("Thêm mới thành công", service.create(r));
    }

    @Operation(summary = "3.5 Ghi lại (không sửa tên đăng nhập)")
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('USER:UPDATE')")
    public ApiResponse<AppUser> update(@PathVariable Long id, @Valid @RequestBody UserRequest r) {
        return ApiResponse.ok("Cập nhật thành công", service.update(id, r));
    }

    @Operation(summary = "3.6 Xóa")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('USER:DELETE')")
    public ApiResponse<Void> delete(@PathVariable Long id, @RequestParam(required = false) Integer version) {
        service.delete(id, version);
        return ApiResponse.okMessage("Xóa thành công");
    }

    @GetMapping("/{id}/roles")
    @PreAuthorize("hasAnyAuthority('USER:VIEW','USER:ASSIGN_ROLE')")
    public ApiResponse<List<AppUser.UserRoleItem>> roles(@PathVariable Long id) {
        return ApiResponse.ok(service.get(id).getRoles());
    }

    @Operation(summary = "3.9 Gán / 3.10 Bỏ gán vai trò")
    @PutMapping("/{id}/roles")
    @PreAuthorize("hasAuthority('USER:ASSIGN_ROLE')")
    public ApiResponse<List<AppUser.UserRoleItem>> saveRoles(@PathVariable Long id, @RequestBody List<UserService.RoleAssign> items) {
        return ApiResponse.ok("Cập nhật vai trò thành công", service.saveRoles(id, items));
    }

    @GetMapping("/import-template")
    @PreAuthorize("hasAuthority('USER:IMPORT')")
    public ResponseEntity<byte[]> template() {
        return Downloads.xlsx("Mau_nhap_nguoi_dung.xlsx", importService.template(importHandler));
    }

    @Operation(summary = "3.7 Nhập dữ liệu — kiểm tra")
    @PostMapping(value = "/import/validate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('USER:IMPORT')")
    public ApiResponse<ImportService.Preview> validate(@RequestPart("file") MultipartFile file) {
        return ApiResponse.ok(importService.validate(importHandler, file));
    }

    @PostMapping("/import/commit")
    @PreAuthorize("hasAuthority('USER:IMPORT')")
    public ApiResponse<ImportService.CommitResult> commit(@RequestBody Map<String, String> body) {
        ImportService.CommitResult r = importService.commit(importHandler, body.get("importToken"));
        return ApiResponse.ok(r.message(), r);
    }

    @Operation(summary = "3.8 Xuất dữ liệu")
    @GetMapping("/export")
    @PreAuthorize("hasAuthority('USER:EXPORT')")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) String keyword, @RequestParam(required = false) String status,
                                         @RequestParam(required = false) Long orgUnitId, PageQuery q) {
        return Downloads.xlsx(Strs.exportFileName("DanhSachNguoiDung"), service.export(service.filter(keyword, status, orgUnitId), q));
    }
}
