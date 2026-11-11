package vn.vnpt.kpi.modules.catalog.controller;

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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vnpt.kpi.common.ApiResponse;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.modules.catalog.model.FormulaDefinition;
import vn.vnpt.kpi.modules.catalog.service.FormulaService;

import java.util.List;
import java.util.Map;

@Tag(name = "Định nghĩa KPI công thức", description = "27.1–27.6")
@RestController
@RequestMapping("/formula-definitions")
@RequiredArgsConstructor
public class FormulaController {
    private final FormulaService service;

    @Operation(summary = "27.1/27.2 Danh sách + tìm kiếm")
    @GetMapping
    @PreAuthorize("hasAnyAuthority('FORMULA:VIEW','KPI:VIEW')")
    public ApiResponse<PageResult<FormulaDefinition>> list(@RequestParam(required = false) String keyword, @RequestParam(required = false) String status,
                                                           @RequestParam(required = false) String definitionType, PageQuery q) {
        return ApiResponse.ok(service.search(keyword, status, definitionType, q));
    }

    @GetMapping("/active")
    @PreAuthorize("hasAnyAuthority('FORMULA:VIEW','KPI:VIEW')")
    public ApiResponse<List<FormulaDefinition>> active() { return ApiResponse.ok(service.active()); }

    @Operation(summary = "27.3 Xem chi tiết (10 lần đồng bộ gần nhất)")
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('FORMULA:VIEW')")
    public ApiResponse<Map<String, Object>> get(@PathVariable Long id) { return ApiResponse.ok(service.get(id)); }

    @Operation(summary = "27.4 Thêm mới")
    @PostMapping
    @PreAuthorize("hasAuthority('FORMULA:CREATE')")
    public ApiResponse<FormulaDefinition> create(@Valid @RequestBody FormulaService.FormulaRequest r) { return ApiResponse.ok("Thêm mới thành công", service.create(r)); }

    @Operation(summary = "27.5 Ghi lại")
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('FORMULA:UPDATE')")
    public ApiResponse<FormulaDefinition> update(@PathVariable Long id, @Valid @RequestBody FormulaService.FormulaRequest r) { return ApiResponse.ok("Cập nhật thành công", service.update(id, r)); }

    @Operation(summary = "27.6 Xóa (chặn nếu thành phần KPI đang dùng)")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('FORMULA:DELETE')")
    public ApiResponse<Void> delete(@PathVariable Long id, @RequestParam(required = false) Integer version) {
        service.delete(id, version);
        return ApiResponse.okMessage("Xóa thành công");
    }

    @Operation(summary = "Kiểm tra kết nối (định nghĩa đã lưu)")
    @PostMapping("/{id}/test")
    @PreAuthorize("hasAuthority('FORMULA:TEST')")
    public ApiResponse<Map<String, Object>> test(@PathVariable Long id, @RequestBody(required = false) FormulaService.TestRequest t) {
        return ApiResponse.ok(service.testById(id, t));
    }

    @Operation(summary = "Kiểm tra kết nối (định nghĩa đang nhập trên form)")
    @PostMapping("/test")
    @PreAuthorize("hasAuthority('FORMULA:TEST')")
    public ApiResponse<Map<String, Object>> testDraft(@RequestBody FormulaService.TestRequest t) { return ApiResponse.ok(service.testConnection(t)); }

    @Operation(summary = "Kiểm tra biểu thức")
    @PostMapping("/validate-expression")
    @PreAuthorize("hasAnyAuthority('FORMULA:TEST','KPI:CREATE','KPI:UPDATE')")
    public ApiResponse<Map<String, Object>> validate(@RequestBody FormulaService.ExpressionCheck c) { return ApiResponse.ok(service.checkExpression(c)); }
}
