package vn.vnpt.kpi.job;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.modules.file.service.FileService;

/** Job DON_DEP_TEP: xóa tệp đã hết hạn lưu giữ (file_object.retention_until &lt; hôm nay) khỏi MinIO và đánh dấu deleted (PHẦN B §9.7) */
@Component
@RequiredArgsConstructor
public class FileRetentionJobHandler implements JobHandler {
    private final FileService files;

    @Override
    public String jobType() { return "DON_DEP_TEP"; }

    @Override
    public Result run(Context ctx) {
        int n = files.purgeExpired();
        return new Result(n, n, 0, "Đã dọn " + n + " tệp hết hạn lưu giữ");
    }
}
