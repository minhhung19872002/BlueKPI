package vn.vnpt.kpi.modules.mykpi.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import vn.vnpt.kpi.common.ApiResponse;
import vn.vnpt.kpi.common.excel.Downloads;
import vn.vnpt.kpi.common.util.Jsons;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.modules.mykpi.service.MyKpiExporter;
import vn.vnpt.kpi.modules.mykpi.service.MyKpiService;

import java.util.List;
import java.util.Map;

@Tag(name = "KPI đơn vị của tôi", description = "18.1–22.1")
@RestController
@RequestMapping("/my-kpi")
@RequiredArgsConstructor
public class MyKpiController {
    private final MyKpiService service;
    private final MyKpiExporter exporter;

    @GetMapping("/units")
    @PreAuthorize("hasAuthority('MYKPI:VIEW')")
    public ApiResponse<Map<String, Object>> units() { return ApiResponse.ok(service.units()); }

    @Operation(summary = "18.1 Xem theo kỳ đánh giá")
    @GetMapping("/by-period")
    @PreAuthorize("hasAuthority('MYKPI:VIEW')")
    public ApiResponse<Map<String, Object>> byPeriod(@RequestParam(required = false) Long unitId, @RequestParam int year, @RequestParam String period) {
        return ApiResponse.ok(service.byPeriod(unitId, year, period));
    }

    @GetMapping("/kpi-options")
    @PreAuthorize("hasAuthority('MYKPI:VIEW')")
    public ApiResponse<List<Map<String, Object>>> kpiOptions(@RequestParam(required = false) Long unitId, @RequestParam int year) {
        return ApiResponse.ok(service.kpiOptions(unitId, year));
    }

    @Operation(summary = "19.1 Xem theo chỉ tiêu KPI")
    @GetMapping("/by-kpi")
    @PreAuthorize("hasAuthority('MYKPI:VIEW')")
    public ApiResponse<Map<String, Object>> byKpi(@RequestParam(required = false) Long unitId, @RequestParam int year, @RequestParam Long kpiId) {
        return ApiResponse.ok(service.byKpi(unitId, year, kpiId));
    }

    @Operation(summary = "20.1 Theo dõi kết quả thẩm định và phản hồi")
    @GetMapping("/review")
    @PreAuthorize("hasAuthority('MYKPI:VIEW')")
    public ApiResponse<List<Map<String, Object>>> review(@RequestParam(required = false) Long unitId, @RequestParam int year, @RequestParam String period) {
        return ApiResponse.ok(service.review(unitId, year, period));
    }

    @GetMapping("/results/{id}")
    @PreAuthorize("hasAuthority('MYKPI:VIEW')")
    public ApiResponse<Map<String, Object>> result(@PathVariable Long id) { return ApiResponse.ok(service.resultDetail(id)); }

    @Operation(summary = "21.1 Đề nghị điều chỉnh kết quả KPI (multipart: data JSON + files)")
    @PostMapping(value = "/results/{id}/adjust-request", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('MYKPI:PROPOSE_ADJUST')")
    public ApiResponse<Map<String, Object>> propose(@PathVariable Long id, @RequestPart("data") String data,
                                                    @RequestPart(value = "files", required = false) List<MultipartFile> files) {
        return ApiResponse.ok("Gửi đề nghị điều chỉnh thành công", service.propose(id, Jsons.fromJson(data, MyKpiService.ProposalInput.class), files));
    }

    @Operation(summary = "22.1 Xuất kết quả đánh giá KPI theo mẫu")
    @GetMapping("/export")
    @PreAuthorize("hasAuthority('MYKPI:EXPORT')")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) Long unitId, @RequestParam int year, @RequestParam String period) {
        return Downloads.xlsx(Strs.exportFileName("KetQuaDanhGiaKPI"), exporter.export(unitId, year, period));
    }
}
