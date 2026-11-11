package vn.vnpt.kpi.modules.evaluation.service;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import vn.vnpt.kpi.modules.evaluation.mapper.EvalProvisionMapper;
import vn.vnpt.kpi.security.CurrentUser;

import java.util.Collection;
import java.util.List;

/**
 * Sinh evaluation_kpi (6 kỳ) và evaluation_result (theo đơn vị) khi chốt giao (31.1), cập nhật KH khi điều chỉnh (34.2).
 * Phát sự kiện {@link ResultsChangedEvent} để engine tính lại các dòng liên quan.
 */
@Service
@RequiredArgsConstructor
public class EvaluationProvisioner {
    private final EvalProvisionMapper mapper;
    private final ApplicationEventPublisher events;

    /** Sự kiện: các dòng evaluation_result cần tính lại */
    public record ResultsChangedEvent(List<Long> resultIds) {}

    public List<Long> provision(Collection<Long> detailIds) {
        if (detailIds.isEmpty()) return List.of();
        String by = CurrentUser.currentUsername();
        for (List<Long> chunk : chunks(detailIds)) {
            mapper.upsertEvaluationKpis(chunk, by);
            mapper.upsertEvaluationResults(chunk, by);
        }
        List<Long> ids = chunks(detailIds).stream().flatMap(c -> mapper.resultIdsOfDetails(c).stream()).toList();
        events.publishEvent(new ResultsChangedEvent(ids));
        return ids;
    }

    private static List<List<Long>> chunks(Collection<Long> ids) {
        List<Long> all = List.copyOf(ids);
        java.util.ArrayList<List<Long>> out = new java.util.ArrayList<>();
        for (int i = 0; i < all.size(); i += 1000) out.add(all.subList(i, Math.min(all.size(), i + 1000)));
        return out;
    }
}
