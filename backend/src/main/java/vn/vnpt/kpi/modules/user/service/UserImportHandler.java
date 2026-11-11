package vn.vnpt.kpi.modules.user.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.excel.ImportHandler;
import vn.vnpt.kpi.common.excel.ImportRow;
import vn.vnpt.kpi.modules.org.mapper.OrgUnitMapper;
import vn.vnpt.kpi.modules.org.model.OrgUnit;
import vn.vnpt.kpi.modules.role.mapper.RoleMapper;
import vn.vnpt.kpi.modules.role.model.Role;
import vn.vnpt.kpi.modules.user.dto.UserRequest;
import vn.vnpt.kpi.modules.user.mapper.UserMapper;
import vn.vnpt.kpi.modules.user.model.AppUser;
import vn.vnpt.kpi.security.PasswordPolicy;
import vn.vnpt.kpi.security.PermissionCodes;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 3.7 Nhập dữ liệu – Người dùng: Họ tên, Email, Tên đăng nhập, Mã đơn vị, Trạng thái, Mã vai trò (nhiều, phân cách dấu phẩy) */
@Component
@RequiredArgsConstructor
public class UserImportHandler implements ImportHandler<UserImportHandler.Row> {
    public record Row(String fullName, String email, String username, Long orgUnitId, String status, List<Long> roleIds,
                      String authSource, String password, String phone) {}

    private final UserMapper userMapper;
    private final OrgUnitMapper orgMapper;
    private final RoleMapper roleMapper;
    private final UserService service;

    @Override public String name() { return "Danh sách người dùng"; }
    @Override public String permission() { return PermissionCodes.USER_IMPORT; }

    @Override
    public List<Column> columns() {
        return List.of(
                new Column("fullName", "Họ tên", true, "Nguyễn Văn A", null),
                new Column("email", "Email", true, "nguyenvana@vnpt.vn", "Duy nhất"),
                new Column("username", "Tên đăng nhập", true, "nguyenvana", "Duy nhất, không sửa được sau khi tạo"),
                new Column("orgCode", "Mã đơn vị", true, "VNPT_HNI", "Xem sheet Don vi"),
                new Column("status", "Trạng thái", true, "Hoạt động", "Hoạt động/Khóa/Ngưng"),
                new Column("roles", "Mã vai trò", false, "NGUOI_DUNG_DV,DANH_GIA_KPI", "Nhiều mã cách nhau dấu phẩy; xem sheet Vai tro"),
                new Column("authSource", "Nguồn xác thực", false, "Cả hai", "Nội bộ/SSO/Cả hai (mặc định SSO khi không có mật khẩu)"),
                new Column("password", "Mật khẩu khởi tạo", false, "", "Bắt buộc nếu có xác thực nội bộ"),
                new Column("phone", "Số điện thoại", false, "0912345678", null));
    }

    @Override
    public Map<String, List<String[]>> lookups() {
        Map<String, List<String[]>> m = new LinkedHashMap<>();
        m.put("Don vi", orgMapper.findAllActive(null, false).stream().map(o -> new String[]{o.getCode(), o.getName()}).toList());
        m.put("Vai tro", roleMapper.findActive().stream().map(r -> new String[]{r.getCode(), r.getName()}).toList());
        m.put("Trang thai", Labels.USER_STATUS.entrySet().stream().map(e -> new String[]{e.getKey(), e.getValue()}).toList());
        return m;
    }

    @Override
    public Row parse(Map<String, String> c, List<String> errors) {
        String email = c.get("email") == null ? null : c.get("email").toLowerCase();
        if (email != null && !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) errors.add("Email không hợp lệ");
        else if (email != null && userMapper.findByEmail(email) != null) errors.add("Email đã tồn tại");
        String username = c.get("username");
        if (username != null && !username.matches("^[A-Za-z0-9._@-]{1,100}$")) errors.add("Tên đăng nhập không hợp lệ");
        else if (username != null && userMapper.findByUsername(username) != null) errors.add("Tên đăng nhập đã tồn tại");
        Long orgId = null;
        if (c.get("orgCode") != null) {
            OrgUnit o = orgMapper.findByCode(c.get("orgCode"));
            if (o == null) errors.add("Mã đơn vị không tồn tại");
            else orgId = o.getId();
        }
        String status = Labels.codeOf(Labels.USER_STATUS, c.get("status"));
        if (c.get("status") != null && status == null) errors.add("Trạng thái không hợp lệ");
        List<Long> roleIds = new ArrayList<>();
        if (c.get("roles") != null) {
            for (String code : Arrays.stream(c.get("roles").split("[,;]")).map(String::trim).filter(s -> !s.isEmpty()).toList()) {
                Role r = roleMapper.findByCode(code);
                if (r == null || !"HIEU_LUC".equals(r.getStatus())) errors.add("Mã vai trò không hợp lệ: " + code);
                else roleIds.add(r.getId());
            }
        }
        String pw = c.get("password");
        String source = c.get("authSource") == null ? (pw == null ? "CAS" : "BOTH") : Labels.codeOf(Labels.AUTH_SOURCE, c.get("authSource"));
        if (source == null) errors.add("Nguồn xác thực không hợp lệ");
        else if (!"CAS".equals(source) && (pw == null || !PasswordPolicy.valid(pw))) errors.add(pw == null ? "Thiếu “Mật khẩu khởi tạo”" : PasswordPolicy.MESSAGE);
        return new Row(c.get("fullName"), email, username, orgId, status, roleIds, source, pw, c.get("phone"));
    }

    @Override
    public void validateBatch(List<ImportRow<Row>> rows) {
        Set<String> users = new HashSet<>(), emails = new HashSet<>();
        for (ImportRow<Row> r : rows) {
            if (r.getRecord() == null) continue;
            if (r.getRecord().username() != null && !users.add(r.getRecord().username())) r.addError("Trùng tên đăng nhập trong file");
            if (r.getRecord().email() != null && !emails.add(r.getRecord().email())) r.addError("Trùng email trong file");
        }
    }

    @Override
    public void commit(List<Row> valid) {
        for (Row r : valid) {
            AppUser u = service.create(new UserRequest(r.fullName(), r.email(), r.orgUnitId(), r.status(), r.username(), r.phone(),
                    r.authSource(), r.password(), null));
            if (!r.roleIds().isEmpty()) {
                service.saveRoles(u.getId(), r.roleIds().stream().map(id -> new UserService.RoleAssign(id, null)).toList());
            }
        }
    }
}
