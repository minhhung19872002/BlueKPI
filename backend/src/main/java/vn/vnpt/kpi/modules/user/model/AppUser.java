package vn.vnpt.kpi.modules.user.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;
import lombok.EqualsAndHashCode;
import vn.vnpt.kpi.common.BaseEntity;

import java.time.LocalDateTime;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
public class AppUser extends BaseEntity {
    private String username;
    private String fullName;
    private String email;
    private String phone;
    private Long orgUnitId;
    private String orgUnitCode;
    private String orgUnitName;
    private String status;
    private String authSource;
    @JsonIgnore
    private String passwordHash;
    private LocalDateTime lastLoginAt;
    private String roleCodes;
    private List<UserRoleItem> roles;

    @Data
    public static class UserRoleItem {
        private Long roleId;
        private String roleCode;
        private String roleName;
        private String roleStatus;
        private Long orgUnitId;
        private String orgUnitName;
        private String assignedBy;
        private LocalDateTime assignedAt;
    }
}
