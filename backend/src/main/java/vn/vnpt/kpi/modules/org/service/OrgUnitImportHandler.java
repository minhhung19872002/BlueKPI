package vn.vnpt.kpi.modules.org.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.excel.ExcelParse;
import vn.vnpt.kpi.common.excel.ImportHandler;
import vn.vnpt.kpi.common.excel.ImportRow;
import vn.vnpt.kpi.modules.org.dto.OrgUnitRequest;
import vn.vnpt.kpi.modules.org.mapper.OrgUnitMapper;
import vn.vnpt.kpi.modules.org.model.OrgUnit;
import vn.vnpt.kpi.security.PermissionCodes;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 5.7 Nhập dữ liệu – Đơn vị: cột “Mã đơn vị cha”; nhập theo thứ tự cha trước con */
@Component
@RequiredArgsConstructor
public class OrgUnitImportHandler implements ImportHandler<OrgUnitImportHandler.Row> {
    public record Row(String code, String name, String parentCode, String shortName, String unitType, String regionCode,
                      boolean assignable, int sortOrder) {}

    private final OrgUnitMapper mapper;
    private final OrgUnitService service;

    @Override public String name() { return "Danh sách đơn vị"; }
    @Override public String permission() { return PermissionCodes.ORG_IMPORT; }

    @Override
    public List<Column> columns() {
        return List.of(
                new Column("code", "Mã đơn vị", true, "VNPT_HNI_P1", "Duy nhất, chỉ gồm chữ/số/_/-/."),
                new Column("name", "Tên đơn vị", true, "Phòng Kinh doanh VNPT Hà Nội", "Tối đa 255 ký tự"),
                new Column("parentCode", "Mã đơn vị cha", false, "VNPT_HNI", "Mã đơn vị đã có hoặc có trong file (dòng cha đặt trước)"),
                new Column("shortName", "Tên viết tắt", false, "P.KD HNI", null),
                new Column("unitType", "Loại đơn vị", true, "PHONG_BAN", "Mã hoặc tên loại đơn vị (xem sheet Loại đơn vị)"),
                new Column("regionCode", "Vùng", false, "MB", "MB/MT/MN"),
                new Column("assignable", "Giao KPI", false, "Có", "Có/Không"),
                new Column("sortOrder", "Thứ tự", false, "1", "Số nguyên"));
    }

    @Override
    public Map<String, List<String[]>> lookups() {
        Map<String, List<String[]>> m = new LinkedHashMap<>();
        m.put("Loai don vi", Labels.UNIT_TYPE.entrySet().stream().map(e -> new String[]{e.getKey(), e.getValue()}).toList());
        m.put("Vung", Labels.REGION.entrySet().stream().map(e -> new String[]{e.getKey(), e.getValue()}).toList());
        return m;
    }

    @Override
    public Row parse(Map<String, String> c, List<String> errors) {
        String code = c.get("code");
        if (code != null && !code.matches("^[A-Za-z0-9_.-]{1,50}$")) errors.add("Mã đơn vị không hợp lệ");
        if (code != null && mapper.findByCode(code) != null) errors.add("Mã đơn vị đã tồn tại");
        ExcelParse.maxLen(c.get("name"), 255, "Tên đơn vị", errors);
        String type = Labels.codeOf(Labels.UNIT_TYPE, c.get("unitType"));
        if (c.get("unitType") != null && type == null) errors.add("Loại đơn vị không hợp lệ");
        String region = c.get("regionCode") == null ? null : Labels.codeOf(Labels.REGION, c.get("regionCode"));
        if (c.get("regionCode") != null && region == null) errors.add("Vùng không hợp lệ");
        Integer sort = ExcelParse.integer(c.get("sortOrder"), "Thứ tự", errors);
        return new Row(code, c.get("name"), c.get("parentCode"), c.get("shortName"), type, region,
                Boolean.TRUE.equals(ExcelParse.bool(c.get("assignable"))), sort == null ? 0 : sort);
    }

    @Override
    public void validateBatch(List<ImportRow<Row>> rows) {
        Set<String> seen = new HashSet<>();
        Map<String, Integer> fileCodes = new HashMap<>();
        for (ImportRow<Row> r : rows) {
            if (r.getRecord() == null || r.getRecord().code() == null) continue;
            if (!seen.add(r.getRecord().code())) r.addError("Trùng mã đơn vị trong file");
            fileCodes.putIfAbsent(r.getRecord().code(), r.getRow());
        }
        for (ImportRow<Row> r : rows) {
            Row x = r.getRecord();
            if (x == null || x.parentCode() == null) continue;
            if (x.parentCode().equals(x.code())) r.addError("Đơn vị cha không được là chính nó");
            else if (mapper.findByCode(x.parentCode()) == null) {
                Integer pr = fileCodes.get(x.parentCode());
                if (pr == null) r.addError("Mã đơn vị cha không tồn tại");
                else if (pr > r.getRow()) r.addError("Dòng đơn vị cha phải đặt trước đơn vị con");
            }
        }
    }

    @Override
    public void commit(List<Row> valid) {
        // cha trước con: các dòng đã kiểm tra thứ tự; tạo lần lượt
        List<Row> pending = new ArrayList<>(valid);
        for (Row r : pending) {
            Long parentId = null;
            if (r.parentCode() != null) {
                OrgUnit p = mapper.findByCode(r.parentCode());
                if (p == null) continue; // cha bị lỗi → bỏ qua con
                parentId = p.getId();
            }
            service.create(new OrgUnitRequest(r.code(), r.name(), parentId, r.shortName(), r.unitType(), r.regionCode(),
                    r.assignable(), r.sortOrder(), null));
        }
    }
}
