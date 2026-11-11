package vn.vnpt.kpi.modules.file.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
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
import vn.vnpt.kpi.modules.file.model.FileObject;
import vn.vnpt.kpi.modules.file.service.FileService;

import java.util.Map;

@Tag(name = "Tệp")
@RestController
@RequestMapping("/files")
@RequiredArgsConstructor
public class FileController {
    private final FileService fileService;

    /** Upload tệp tạm (chưa gắn đối tượng) — gắn khi nghiệp vụ lưu */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Map<String, Object>> upload(@RequestPart("file") MultipartFile file) {
        FileObject f = fileService.upload(file, null, null);
        return ApiResponse.ok("Tải tệp lên thành công", Map.of("id", f.getId(), "name", f.getOriginalName(), "size", f.getSize()));
    }

    @GetMapping("/{id}/url")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Map<String, Object>> url(@PathVariable Long id) {
        return ApiResponse.ok(Map.of("url", fileService.presignedUrl(id), "ttlSeconds", 300));
    }

    @GetMapping("/{id}/meta")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<FileObject> meta(@PathVariable Long id) {
        return ApiResponse.ok(fileService.meta(id));
    }

    @GetMapping("/allowed-ext")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Object> allowed(@RequestParam(required = false) String dummy) {
        return ApiResponse.ok(fileService.allowedExt());
    }
}
