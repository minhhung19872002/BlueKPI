package vn.vnpt.kpi.integration.hrm;

import org.springframework.stereotype.Component;

import java.util.List;

/** Adapter stub bản đầu (chờ đặc tả API HRM — OPEN-QUESTIONS #6) */
@Component
public class StubHrmClient implements HrmClient {
    @Override
    public List<HrmOrgUnit> syncOrgUnits() { return List.of(); }

    @Override
    public List<HrmUser> syncUsers() { return List.of(); }
}
