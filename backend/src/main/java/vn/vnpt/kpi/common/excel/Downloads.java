package vn.vnpt.kpi.common.excel;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;

/** ResponseEntity tải file với Content-Disposition (UTF-8) */
public final class Downloads {
    public static final MediaType XLSX = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private Downloads() {}

    public static ResponseEntity<byte[]> xlsx(String fileName, byte[] bytes) {
        return file(fileName, XLSX, bytes);
    }

    public static ResponseEntity<byte[]> file(String fileName, MediaType type, byte[] bytes) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(type);
        h.setContentDisposition(ContentDisposition.attachment().filename(fileName, StandardCharsets.UTF_8).build());
        h.setContentLength(bytes.length);
        h.setCacheControl("no-store");
        return ResponseEntity.ok().headers(h).body(bytes);
    }
}
