package vn.vnpt.kpi.modules.schedule.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
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
import vn.vnpt.kpi.modules.schedule.model.SyncSchedule;
import vn.vnpt.kpi.modules.schedule.service.ScheduleService;

import java.util.Map;

@Tag(name = "Lịch đồng bộ", description = "26.17–26.19")
@RestController
@RequestMapping("/schedules")
@RequiredArgsConstructor
public class ScheduleController {
    private final ScheduleService service;

    @Operation(summary = "26.17 Danh sách lịch đồng bộ")
    @GetMapping
    @PreAuthorize("hasAuthority('SCHEDULE:VIEW')")
    public ApiResponse<PageResult<SyncSchedule>> list(@RequestParam(required = false) String keyword, PageQuery q) {
        return ApiResponse.ok(service.search(keyword, q));
    }

    @Operation(summary = "26.18 Xem chi tiết + 20 lần chạy gần nhất")
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('SCHEDULE:VIEW')")
    public ApiResponse<Map<String, Object>> get(@PathVariable Long id) {
        return ApiResponse.ok(service.get(id));
    }

    @Operation(summary = "26.19 Ghi lại — reschedule trigger Quartz ngay")
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('SCHEDULE:UPDATE')")
    public ApiResponse<SyncSchedule> update(@PathVariable Long id, @Valid @RequestBody ScheduleService.ScheduleUpdate u) {
        return ApiResponse.ok("Cập nhật thành công", service.update(id, u));
    }

    @Operation(summary = "Chạy ngay")
    @PostMapping("/{id}/run")
    @PreAuthorize("hasAuthority('SCHEDULE:RUN')")
    public ApiResponse<Void> run(@PathVariable Long id) {
        service.runNow(id);
        return ApiResponse.okMessage("Đã gửi yêu cầu chạy lịch. Kết quả cập nhật tại “Lần chạy gần nhất”.");
    }
}
