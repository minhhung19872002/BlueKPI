package vn.vnpt.kpi.common.excel;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Getter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Một dòng trong bảng xem trước: Dòng, dữ liệu, Trạng thái (Hợp lệ/Lỗi), Mô tả lỗi */
@Getter
public class ImportRow<R> {
    private final int row;
    private final Map<String, String> data;
    private final List<String> errors = new ArrayList<>();
    @JsonIgnore
    private R record;

    public ImportRow(int row, Map<String, String> data) {
        this.row = row;
        this.data = data;
    }

    public void setRecord(R record) { this.record = record; }

    public boolean isValid() { return errors.isEmpty(); }

    public String getStatus() { return isValid() ? "Hợp lệ" : "Lỗi"; }

    public String getErrorMessage() { return String.join("; ", errors); }

    public void addError(String e) { errors.add(e); }
}
