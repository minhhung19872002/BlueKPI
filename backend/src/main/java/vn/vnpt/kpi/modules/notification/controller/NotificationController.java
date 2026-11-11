package vn.vnpt.kpi.modules.notification.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vnpt.kpi.common.ApiResponse;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.modules.notification.model.Notification;
import vn.vnpt.kpi.modules.notification.service.NotificationService;
import vn.vnpt.kpi.security.CurrentUser;

import java.util.Map;

/** 54.1 Thông báo trên hệ thống — mỗi user chỉ thấy thông báo của mình */
@Tag(name = "Thông báo")
@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class NotificationController {
    private final NotificationService service;

    @GetMapping
    public ApiResponse<PageResult<Notification>> list(@RequestParam(defaultValue = "false") boolean unreadOnly, PageQuery q) {
        return ApiResponse.ok(service.list(CurrentUser.current().getId(), unreadOnly, q));
    }

    @GetMapping("/unread-count")
    public ApiResponse<Map<String, Long>> unread() {
        return ApiResponse.ok(Map.of("count", service.unreadCount(CurrentUser.current().getId())));
    }

    @PostMapping("/{id}/read")
    public ApiResponse<Void> read(@PathVariable Long id) {
        service.markRead(id, CurrentUser.current().getId());
        return ApiResponse.okMessage("Đã đánh dấu đã đọc");
    }

    @PostMapping("/read-all")
    public ApiResponse<Void> readAll() {
        service.markAllRead(CurrentUser.current().getId());
        return ApiResponse.okMessage("Đã đánh dấu tất cả đã đọc");
    }
}
