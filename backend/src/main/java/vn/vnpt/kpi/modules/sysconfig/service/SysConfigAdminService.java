package vn.vnpt.kpi.modules.sysconfig.service;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.Guards;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.common.util.Jsons;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.modules.sysconfig.mapper.SysConfigMapper;
import vn.vnpt.kpi.modules.sysconfig.model.SysConfig;
import vn.vnpt.kpi.security.CurrentUser;

import java.math.BigDecimal;
import java.util.Map;

/** CRUD Tham số hệ thống (26.20–26.24). Giá trị secret không trả về FE */
@Service
@RequiredArgsConstructor
public class SysConfigAdminService {
    public static final String SECRET_MASK = "********";
    static final Map<String, String> SORT = Map.of("configKey", "config_key", "configGroup", "config_group", "dataType", "data_type",
            "updatedAt", "updated_at");

    public record ConfigRequest(
            @NotBlank(message = "Vui lòng nhập Mã tham số") @Size(max = 100) @Pattern(regexp = "^[A-Z0-9_]+$", message = "Mã tham số chỉ gồm chữ in hoa, số và dấu gạch dưới") String configKey,
            @NotBlank(message = "Vui lòng nhập Giá trị") @Size(max = 4000) String configValue,
            @NotBlank(message = "Vui lòng chọn Kiểu dữ liệu") @Pattern(regexp = "STRING|NUMBER|BOOLEAN|JSON", message = "Kiểu dữ liệu không hợp lệ") String dataType,
            @Size(max = 50) String configGroup,
            @Size(max = 1000) String description,
            Boolean isSecret,
            Integer version) {}

    private final SysConfigMapper mapper;
    private final SysConfigService cache;
    private final AuditService audit;

    public PageResult<SysConfig> search(String keyword, String group, String dataType, PageQuery q) {
        q.applySort(SORT, "config_group, config_key");
        String kw = Strs.like(keyword);
        return PageResult.of(mapper.search(kw, group, dataType, q).stream().map(SysConfigAdminService::mask).toList(),
                mapper.count(kw, group, dataType), q);
    }

    public SysConfig get(Long id) {
        return mask(Guards.found(mapper.findById(id), "tham số"));
    }

    @Transactional
    public SysConfig create(ConfigRequest r) {
        if (mapper.findByKey(r.configKey()) != null) throw BusinessException.field("configKey", "Mã tham số đã tồn tại");
        validateValue(r.dataType(), r.configValue());
        SysConfig c = toEntity(r);
        c.setCreatedBy(CurrentUser.currentUsername());
        mapper.insert(c);
        cache.evict();
        audit.log("THEM", "sys_config", c.getId(), null, mask(c));
        return get(c.getId());
    }

    @Transactional
    public SysConfig update(Long id, ConfigRequest r) {
        SysConfig before = Guards.found(mapper.findById(id), "tham số");
        if (!before.getConfigKey().equals(r.configKey())) throw BusinessException.field("configKey", "Mã tham số không được sửa");
        SysConfig c = toEntity(r);
        c.setId(id);
        // secret: giữ giá trị cũ khi FE gửi lại giá trị che
        if (Boolean.TRUE.equals(before.getIsSecret()) && SECRET_MASK.equals(r.configValue())) c.setConfigValue(before.getConfigValue());
        else validateValue(r.dataType(), r.configValue());
        c.setVersion(r.version() == null ? before.getVersion() : r.version());
        Guards.updated(mapper.update(c));
        cache.evict();
        audit.log("SUA", "sys_config", id, mask(before), mask(mapper.findById(id)));
        return get(id);
    }

    @Transactional
    public void delete(Long id, Integer version) {
        SysConfig c = Guards.found(mapper.findById(id), "tham số");
        if (Boolean.TRUE.equals(c.getIsCore())) throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Không được xóa tham số hệ thống lõi");
        Guards.updated(mapper.softDelete(id, version == null ? c.getVersion() : version, CurrentUser.currentUsername()));
        cache.evict();
        audit.log("XOA", "sys_config", id, mask(c), null);
    }

    static void validateValue(String type, String v) {
        String t = v.trim();
        switch (type) {
            case "NUMBER" -> {
                try {
                    new BigDecimal(t);
                } catch (NumberFormatException e) {
                    throw BusinessException.field("configValue", "Giá trị phải là số");
                }
            }
            case "BOOLEAN" -> {
                if (!t.equalsIgnoreCase("true") && !t.equalsIgnoreCase("false")) throw BusinessException.field("configValue", "Giá trị phải là true hoặc false");
            }
            case "JSON" -> {
                if (!Jsons.isValidJson(t)) throw BusinessException.field("configValue", "Giá trị phải là JSON hợp lệ");
            }
            default -> { }
        }
    }

    private static SysConfig toEntity(ConfigRequest r) {
        SysConfig c = new SysConfig();
        c.setConfigKey(r.configKey());
        c.setConfigValue(r.configValue().trim());
        c.setDataType(r.dataType());
        c.setConfigGroup(Strs.trimToNull(r.configGroup()));
        c.setDescription(Strs.trimToNull(r.description()));
        c.setIsSecret(Boolean.TRUE.equals(r.isSecret()));
        c.setUpdatedBy(CurrentUser.currentUsername());
        return c;
    }

    static SysConfig mask(SysConfig c) {
        if (c != null && Boolean.TRUE.equals(c.getIsSecret())) c.setConfigValue(SECRET_MASK);
        return c;
    }
}
