package vn.vnpt.kpi.modules.file.service;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.config.MinioProperties;
import vn.vnpt.kpi.modules.file.mapper.FileMapper;
import vn.vnpt.kpi.modules.file.model.FileObject;
import vn.vnpt.kpi.modules.sysconfig.service.SysConfigService;
import vn.vnpt.kpi.security.CurrentUser;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Lưu tệp MinIO (PHẦN B §9.7): whitelist đuôi, magic bytes (Tika), giới hạn kích thước, sha256,
 * hook quét mã độc, retention; presigned URL TTL 300s chỉ cấp sau khi kiểm tra quyền trên đối tượng sở hữu.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileService {
    private static final Tika TIKA = new Tika();
    private static final Map<String, Set<String>> EXT_MIME = Map.of(
            "xlsx", Set.of("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/x-tika-ooxml", "application/zip"),
            "xls", Set.of("application/vnd.ms-excel", "application/x-tika-msoffice"),
            "docx", Set.of("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/x-tika-ooxml", "application/zip"),
            "pdf", Set.of("application/pdf"),
            "png", Set.of("image/png"),
            "jpg", Set.of("image/jpeg"),
            "jpeg", Set.of("image/jpeg"));

    private final MinioClient minio;
    private final MinioProperties props;
    private final FileMapper fileMapper;
    private final SysConfigService config;
    private final MalwareScanner scanner;
    private final FileAccessPolicy accessPolicy;
    private final AuditService audit;
    private volatile boolean bucketReady;

    public FileObject upload(MultipartFile file, String ownerType, Long ownerId) {
        try {
            return store(file.getBytes(), file.getOriginalFilename(), ownerType, ownerId);
        } catch (java.io.IOException e) {
            throw new BusinessException(ErrorCode.ERR_FILE, "Không đọc được tệp tải lên");
        }
    }

    @Transactional
    public FileObject store(byte[] bytes, String originalName, String ownerType, Long ownerId) {
        String name = sanitize(originalName);
        String ext = ext(name);
        validate(bytes, name, ext);
        String detected = TIKA.detect(bytes, name);
        Set<String> allowedMime = EXT_MIME.get(ext);
        if (allowedMime != null && !allowedMime.contains(detected)) {
            throw new BusinessException(ErrorCode.ERR_FILE, "Nội dung tệp không khớp định dạng ." + ext);
        }
        String scan = scanner.scan(bytes);
        if ("NHIEM".equals(scan)) throw new BusinessException(ErrorCode.ERR_FILE, "Tệp bị phát hiện mã độc, không thể tải lên");
        if (MalwareScanner.UNAVAILABLE.equals(scan)) throw new BusinessException(ErrorCode.ERR_FILE, "Dịch vụ quét mã độc không sẵn sàng, vui lòng thử lại sau");

        String key = LocalDate.now() + "/" + UUID.randomUUID() + "." + ext;
        ensureBucket();
        try (InputStream in = new ByteArrayInputStream(bytes)) {
            minio.putObject(PutObjectArgs.builder().bucket(props.bucket()).object(key)
                    .stream(in, bytes.length, -1).contentType(contentTypeOf(ext)).build());
        } catch (Exception e) {
            log.error("Lưu MinIO thất bại", e);
            throw new BusinessException(ErrorCode.ERR_INTEGRATION, "Không lưu được tệp vào kho lưu trữ");
        }
        FileObject f = new FileObject();
        f.setBucket(props.bucket());
        f.setObjectKey(key);
        f.setOriginalName(name);
        f.setContentType(contentTypeOf(ext));
        f.setSize((long) bytes.length);
        f.setSha256(sha256(bytes));
        f.setScanStatus(scan);
        f.setOwnerType(ownerType);
        f.setOwnerId(ownerId);
        f.setUploadedBy(CurrentUser.currentUsername());
        f.setRetentionUntil(LocalDate.now().plusYears(config.getInt("FILE_RETENTION_YEARS", 10)));
        fileMapper.insert(f);
        audit.log("TAI_LEN_TEP", "file_object", f.getId(), null, Map.of("name", name, "size", bytes.length, "sha256", f.getSha256()));
        return f;
    }

    void validate(byte[] bytes, String name, String ext) {
        if (bytes == null || bytes.length == 0) throw new BusinessException(ErrorCode.ERR_FILE, "Tệp rỗng");
        int maxMb = config.getInt(SysConfigService.UPLOAD_MAX_MB, 10);
        if (bytes.length > (long) maxMb * 1024 * 1024) {
            throw new BusinessException(ErrorCode.ERR_FILE, "Tệp vượt quá dung lượng cho phép (" + maxMb + " MB)");
        }
        Set<String> allowed = allowedExt();
        if (!allowed.contains(ext)) {
            throw new BusinessException(ErrorCode.ERR_FILE, "Định dạng tệp không được phép. Chỉ chấp nhận: " + String.join(", ", allowed));
        }
    }

    public Set<String> allowedExt() {
        String s = config.getString(SysConfigService.UPLOAD_ALLOWED_EXT, "xlsx,xls,docx,pdf,png,jpg,jpeg");
        return Set.copyOf(Arrays.stream(s.split(",")).map(x -> x.trim().toLowerCase(Locale.ROOT)).filter(x -> !x.isEmpty())
                .filter(EXT_MIME::containsKey).toList());
    }

    public FileObject meta(Long id) {
        FileObject f = fileMapper.findById(id);
        if (f == null) throw BusinessException.notFound("tệp");
        accessPolicy.assertCanRead(f, CurrentUser.current());
        return f;
    }

    /** Presigned URL TTL 300s — kiểm tra quyền trước */
    public String presignedUrl(Long id) {
        FileObject f = meta(id);
        try {
            return minio.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder().method(Method.GET)
                    .bucket(f.getBucket()).object(f.getObjectKey())
                    .expiry(props.presignTtlSeconds(), TimeUnit.SECONDS)
                    .extraQueryParams(Map.of("response-content-disposition",
                            "attachment; filename*=UTF-8''" + java.net.URLEncoder.encode(f.getOriginalName(), java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20")))
                    .build());
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.ERR_INTEGRATION, "Không tạo được liên kết tải tệp");
        }
    }

    /** Đọc nội dung (dùng nội bộ: template báo cáo) */
    public byte[] read(FileObject f) {
        try (InputStream in = minio.getObject(GetObjectArgs.builder().bucket(f.getBucket()).object(f.getObjectKey()).build())) {
            return in.readAllBytes();
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.ERR_INTEGRATION, "Không đọc được tệp từ kho lưu trữ");
        }
    }

    public List<FileObject> listByOwner(String ownerType, Long ownerId) {
        return fileMapper.findByOwner(ownerType, ownerId);
    }

    public void attach(List<Long> ids, String ownerType, Long ownerId) {
        if (ids != null && !ids.isEmpty()) fileMapper.attach(ids, ownerType, ownerId);
    }

    /** Job dọn tệp hết hạn lưu giữ */
    public int purgeExpired() {
        int n = 0;
        for (FileObject f : fileMapper.findExpired(LocalDate.now())) {
            try {
                minio.removeObject(RemoveObjectArgs.builder().bucket(f.getBucket()).object(f.getObjectKey()).build());
                fileMapper.markDeleted(f.getId());
                n++;
            } catch (Exception e) {
                log.warn("Không xóa được tệp hết hạn id={}", f.getId());
            }
        }
        return n;
    }

    private void ensureBucket() {
        if (bucketReady) return;
        try {
            if (!minio.bucketExists(BucketExistsArgs.builder().bucket(props.bucket()).build())) {
                minio.makeBucket(MakeBucketArgs.builder().bucket(props.bucket()).build());
            }
            bucketReady = true;
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.ERR_INTEGRATION, "Kho lưu trữ tệp không sẵn sàng");
        }
    }

    static String sanitize(String name) {
        if (name == null || name.isBlank()) return "file";
        String n = name.replace("\\", "/");
        n = n.substring(n.lastIndexOf('/') + 1).replaceAll("[\\r\\n\\t\"<>|:*?]", "_");
        return n.length() > 200 ? n.substring(n.length() - 200) : n;
    }

    static String ext(String name) {
        int i = name.lastIndexOf('.');
        return i < 0 ? "" : name.substring(i + 1).toLowerCase(Locale.ROOT);
    }

    static String contentTypeOf(String ext) {
        return switch (ext) {
            case "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case "xls" -> "application/vnd.ms-excel";
            case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case "pdf" -> "application/pdf";
            case "png" -> "image/png";
            case "jpg", "jpeg" -> "image/jpeg";
            default -> "application/octet-stream";
        };
    }

    static String sha256(byte[] b) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
