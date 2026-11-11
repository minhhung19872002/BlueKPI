package vn.vnpt.kpi.integration.hrm;

import java.util.List;

/** Tích hợp VNPT HRM (mở rộng) — PHẦN B §8.3: đồng bộ tổ chức đơn vị và nhân sự */
public interface HrmClient {
    record HrmOrgUnit(String hrmRef, String code, String name, String parentHrmRef, String unitType) {}

    record HrmUser(String hrmRef, String username, String fullName, String email, String orgHrmRef) {}

    List<HrmOrgUnit> syncOrgUnits();

    List<HrmUser> syncUsers();
}
