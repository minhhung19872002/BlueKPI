package vn.vnpt.kpi.modules.file.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.modules.file.mapper.FileOwnerMapper;
import vn.vnpt.kpi.modules.file.model.FileObject;
import vn.vnpt.kpi.security.CurrentUser;
import vn.vnpt.kpi.security.DataScopeService;
import vn.vnpt.kpi.security.PermissionCodes;

/**
 * Kiểm tra quyền trên đối tượng sở hữu tệp trước khi cấp presigned URL (PHẦN B §9.6).
 */
@Component
@RequiredArgsConstructor
public class FileAccessPolicy {
    public static final String OWNER_ADJUST_REQUEST = "ADJUST_REQUEST";
    public static final String OWNER_ADJUST_DECISION = "ADJUST_DECISION";
    public static final String OWNER_REPORT_TEMPLATE = "REPORT_TEMPLATE";
    public static final String OWNER_IMPORT_ERROR = "IMPORT_ERROR";
    public static final String OWNER_EXPORT = "EXPORT";

    private final DataScopeService scopeService;
    private final FileOwnerMapper ownerMapper;

    public void assertCanRead(FileObject f, CurrentUser u) {
        String type = f.getOwnerType();
        if (type == null || f.getOwnerId() == null) {
            // tệp tạm chưa gắn đối tượng: chỉ người tải lên được đọc
            if (u.getUsername().equals(f.getUploadedBy())) return;
            throw new BusinessException(ErrorCode.ERR_FORBIDDEN);
        }
        switch (type) {
            case OWNER_ADJUST_REQUEST, OWNER_ADJUST_DECISION -> {
                Long unitId = OWNER_ADJUST_REQUEST.equals(type)
                        ? ownerMapper.unitOfAdjustRequest(f.getOwnerId()) : ownerMapper.unitOfResult(f.getOwnerId());
                if (unitId == null) throw new BusinessException(ErrorCode.ERR_FORBIDDEN);
                boolean ok = scopeService.scopeFor(u, PermissionCodes.EVAL_VIEW).contains(unitId)
                        || scopeService.scopeFor(u, PermissionCodes.BSC_VIEW).contains(unitId)
                        || scopeService.scopeFor(u, PermissionCodes.MYKPI_VIEW).contains(unitId);
                if (!ok) throw new BusinessException(ErrorCode.ERR_FORBIDDEN);
            }
            case OWNER_REPORT_TEMPLATE -> {
                if (!u.has(PermissionCodes.BSC_REPORT) && !u.has(PermissionCodes.SYSCONFIG_VIEW)) throw new BusinessException(ErrorCode.ERR_FORBIDDEN);
            }
            case OWNER_IMPORT_ERROR, OWNER_EXPORT -> {
                if (!u.getUsername().equals(f.getUploadedBy())) throw new BusinessException(ErrorCode.ERR_FORBIDDEN);
            }
            default -> throw new BusinessException(ErrorCode.ERR_FORBIDDEN);
        }
    }
}
