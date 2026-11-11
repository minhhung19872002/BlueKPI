package vn.vnpt.kpi.job;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.common.util.Jsons;
import vn.vnpt.kpi.modules.sysconfig.service.SysConfigService;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.GZIPOutputStream;

/**
 * Sao lưu logic dữ liệu (job SAO_LUU_LOGIC, có nút “Chạy ngay”) — PHẦN D §1.a: bổ sung cho mariabackup hằng ngày.
 * Mỗi bảng → file JSON Lines nén gzip trong BACKUP_DIR/yyyyMMdd_HHmmss; giữ N bản gần nhất (params.keep, mặc định 8).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LogicalBackupJobHandler implements JobHandler {
    static final List<String> TABLES = List.of("org_unit", "app_user", "role", "permission", "menu", "role_permission", "user_role",
            "unit_of_measure", "perspective", "strategic_objective", "formula_definition", "scoring_method", "evaluation_stage",
            "kpi", "kpi_component", "strategy", "strategy_objective", "strategy_link", "strategy_kpi", "kpi_assignment",
            "kpi_assignment_detail", "kpi_assignment_adjustment", "kpi_assignment_adjustment_line", "kpi_assignment_history",
            "kpi_officer_map", "evaluation_kpi", "evaluation_result", "evaluation_component_value", "adjustment_request",
            "evaluation_feedback", "evaluation_status_history", "period_closing", "bsc_unit_summary", "report_template",
            "sys_config", "sync_schedule", "file_object", "formula_result");

    private final JdbcTemplate jdbc;
    private final SysConfigService config;

    @Override
    public String jobType() { return "SAO_LUU_LOGIC"; }

    @Override
    public Result run(Context ctx) throws IOException {
        Path base = Path.of(config.getString("BACKUP_DIR", System.getProperty("java.io.tmpdir") + "/kpi-backup"));
        Path dir = base.resolve(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")));
        Files.createDirectories(dir);
        ObjectMapper om = Jsons.mapper();
        int ok = 0, fail = 0;
        long rows = 0;
        for (String t : TABLES) {
            Path f = dir.resolve(t + ".jsonl.gz");
            try (BufferedWriter w = new BufferedWriter(new OutputStreamWriter(new GZIPOutputStream(Files.newOutputStream(f)), StandardCharsets.UTF_8))) {
                long[] n = {0};
                jdbc.query("SELECT * FROM " + t, rs -> {
                    var md = rs.getMetaData();
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= md.getColumnCount(); i++) row.put(md.getColumnLabel(i), rs.getObject(i));
                    try {
                        w.write(om.writeValueAsString(row));
                        w.newLine();
                    } catch (IOException e) {
                        throw new IllegalStateException(e);
                    }
                    n[0]++;
                });
                rows += n[0];
                ok++;
            } catch (Exception e) {
                log.warn("Sao lưu bảng {} lỗi: {}", t, e.getMessage());
                fail++;
            }
        }
        int keep = ctx.params().get("keep") instanceof Number n ? n.intValue() : 8;
        try (var s = Files.list(base)) {
            List<Path> dirs = s.filter(Files::isDirectory).sorted(Comparator.reverseOrder()).toList();
            for (int i = keep; i < dirs.size(); i++) deleteDir(dirs.get(i));
        }
        return new Result(TABLES.size(), ok, fail, "Đã sao lưu " + ok + "/" + TABLES.size() + " bảng, " + rows + " bản ghi vào " + dir);
    }

    private static void deleteDir(Path p) throws IOException {
        try (var w = Files.walk(p)) {
            for (Path x : w.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(x);
        }
    }
}
