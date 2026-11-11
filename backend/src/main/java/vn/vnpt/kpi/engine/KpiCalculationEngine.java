package vn.vnpt.kpi.engine;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Engine tính toán KPI (PHẦN B §6) — HÀM THUẦN: đầu vào DTO → đầu ra DTO, không phụ thuộc Spring/DB.
 * Mọi tham số [GIẢ ĐỊNH] truyền qua {@link Config} / {@link Scoring} (cấu hình từ sys_config, scoring_method.config).
 * Lưu scale 4, RoundingMode.HALF_UP.
 */
public final class KpiCalculationEngine {
    public static final int SCALE = 4;
    static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private KpiCalculationEngine() {}

    // ============================== DTO ==============================
    /** Tham số hệ thống: KPI_PASS_SCORE, KPI_WARNING_RATE, KPI_COMPLETION_CAP */
    public record Config(BigDecimal passScore, BigDecimal warningRate, BigDecimal completionCap) {
        public static Config defaults() { return new Config(BigDecimal.valueOf(3), BigDecimal.valueOf(90), BigDecimal.valueOf(200)); }
    }

    /** Khung điểm: from ≤ % &lt; to (from/to null = vô cực) */
    public record Band(BigDecimal from, BigDecimal to, BigDecimal score) {}

    /** scoring_method: KHUNG_TY_LE | DAT_KHONG_DAT | NHAP_DIEM */
    public record Scoring(String type, List<Band> bands, BigDecimal passRate, BigDecimal passScore, BigDecimal failScore, BigDecimal maxScore) {
        public static Scoring defaultBands() {
            return new Scoring("KHUNG_TY_LE", List.of(
                    new Band(null, bd(70), bd(1)), new Band(bd(70), bd(85), bd(2)), new Band(bd(85), bd(100), bd(3)),
                    new Band(bd(100), bd(110), bd(4)), new Band(bd(110), null, bd(5))), null, null, null, bd(5));
        }

        public static Scoring datKhongDat() { return new Scoring("DAT_KHONG_DAT", List.of(), bd(100), bd(5), bd(1), bd(5)); }

        public static Scoring nhapDiem() { return new Scoring("NHAP_DIEM", List.of(), null, null, null, bd(5)); }
    }

    public record ComponentIn(String code, BigDecimal value, BigDecimal prevAdjustment, BigDecimal adjustment) {}

    public record ComponentOut(String code, BigDecimal finalValue) {}

    /**
     * @param plan          KH giao kỳ (đã tính điều chỉnh)
     * @param yearPlan      KH năm
     * @param manualScore   điểm nhập tay (NHAP_DIEM hoặc score_by_result = false)
     */
    public record Input(String completionFormula, String completionExpression, String resultExpression, Scoring scoring, boolean scoreByResult,
                        BigDecimal manualScore, BigDecimal plan, BigDecimal yearPlan, List<ComponentIn> components,
                        BigDecimal prevAdjustment, BigDecimal adjustment) {}

    public record Output(List<ComponentOut> components, BigDecimal kpiResult, BigDecimal finalResult, BigDecimal completionRate,
                         BigDecimal yearCompletionRate, BigDecimal score, String rating, boolean warning, String error) {
        public boolean hasResult() { return finalResult != null || score != null; }
    }

    // ============================== Tính một dòng (KPI × kỳ × đơn vị) ==============================
    public static Output calculate(Input in, Config cfg) {
        List<String> errors = new ArrayList<>();
        // 6.2: final thành phần = value + ĐC kỳ trước + điều chỉnh
        List<ComponentOut> comps = new ArrayList<>();
        Map<String, BigDecimal> vars = new HashMap<>();
        for (ComponentIn c : in.components() == null ? List.<ComponentIn>of() : in.components()) {
            BigDecimal f = c.value() == null ? null : c.value().add(nz(c.prevAdjustment())).add(nz(c.adjustment()));
            comps.add(new ComponentOut(c.code(), scale(f)));
            vars.put(c.code(), f);
        }
        BigDecimal kpiResult = null;
        if (!vars.isEmpty()) {
            String expr = in.resultExpression() == null || in.resultExpression().isBlank() ? comps.get(0).code() : in.resultExpression();
            FormulaEvaluator.Result r = FormulaEvaluator.eval(expr, vars);
            if (r.error() != null) errors.add(r.error());
            kpiResult = r.value();
        }
        BigDecimal finalResult = kpiResult == null ? null : kpiResult.add(nz(in.prevAdjustment())).add(nz(in.adjustment()));

        // 6.3 Tỷ lệ hoàn thành
        BigDecimal rate = completion(in.completionFormula(), in.completionExpression(), finalResult, in.plan(), in.yearPlan(), cfg, errors);
        BigDecimal yearRate = finalResult == null || in.yearPlan() == null || in.yearPlan().signum() == 0 ? null
                : finalResult.multiply(HUNDRED).divide(in.yearPlan(), 10, RoundingMode.HALF_UP);
        if ("NGHICH".equals(in.completionFormula()) && finalResult != null && in.yearPlan() != null) {
            yearRate = finalResult.signum() == 0 ? cfg.completionCap() : in.yearPlan().multiply(HUNDRED).divide(finalResult, 10, RoundingMode.HALF_UP);
        }

        // 6.4 Điểm
        BigDecimal score = score(in, rate);
        // 6.5 Phân loại
        String rating = score == null ? "DANG_THEO_DOI" : score.compareTo(cfg.passScore()) >= 0 ? "DAT_VUOT" : "CHUA_DAT";
        boolean warning = "CHUA_DAT".equals(rating) || (rate != null && rate.compareTo(cfg.warningRate()) < 0);
        return new Output(comps, scale(kpiResult), scale(finalResult), scale(rate), scale(yearRate), scale(score), rating, warning,
                errors.isEmpty() ? null : String.join("; ", errors));
    }

    static BigDecimal completion(String formula, String expr, BigDecimal fin, BigDecimal plan, BigDecimal yearPlan, Config cfg, List<String> errors) {
        if (fin == null) return null;
        String f = formula == null ? "THUAN" : formula;
        switch (f) {
            case "NGHICH" -> {
                if (plan == null) return null;
                if (fin.signum() == 0) return cfg.completionCap();
                return plan.multiply(HUNDRED).divide(fin, 10, RoundingMode.HALF_UP);
            }
            case "TUY_CHINH" -> {
                Map<String, BigDecimal> v = new HashMap<>();
                v.put("TH", fin);
                v.put("KH", plan);
                v.put("KH_NAM", yearPlan);
                FormulaEvaluator.Result r = FormulaEvaluator.eval(expr, v);
                if (r.error() != null) errors.add(r.error());
                return r.value();
            }
            default -> {
                if (plan == null || plan.signum() == 0) return null;
                return fin.multiply(HUNDRED).divide(plan, 10, RoundingMode.HALF_UP);
            }
        }
    }

    static BigDecimal score(Input in, BigDecimal rate) {
        if (!in.scoreByResult()) return in.manualScore();
        Scoring s = in.scoring() == null ? Scoring.defaultBands() : in.scoring();
        switch (s.type()) {
            case "NHAP_DIEM" -> { return in.manualScore(); }
            case "DAT_KHONG_DAT" -> {
                if (rate == null) return null;
                BigDecimal pass = s.passRate() == null ? HUNDRED : s.passRate();
                return rate.compareTo(pass) >= 0 ? nzOr(s.passScore(), 5) : nzOr(s.failScore(), 1);
            }
            default -> {
                if (rate == null) return null;
                for (Band b : s.bands()) {
                    boolean geFrom = b.from() == null || rate.compareTo(b.from()) >= 0;
                    boolean ltTo = b.to() == null || rate.compareTo(b.to()) < 0;
                    if (geFrom && ltTo) return b.score();
                }
                return null;
            }
        }
    }

    // ============================== 6.2 ĐC kỳ trước ==============================
    /** ĐC kỳ trước = tổng điều chỉnh các kỳ trước cùng năm, chỉ khi LUY_KE (ngược lại 0) [GIẢ ĐỊNH] */
    public static BigDecimal prevAdjustment(String targetDataType, List<BigDecimal> previousAdjustments) {
        if (!"LUY_KE".equals(targetDataType) || previousAdjustments == null) return BigDecimal.ZERO;
        return previousAdjustments.stream().map(KpiCalculationEngine::nz).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // ============================== 6.6 Điểm BSC ==============================
    public record WeightedScore(BigDecimal score, BigDecimal weight) {}

    /** Điểm BSC chỉ tiêu = score × weight / Σweight */
    public static BigDecimal bscItem(BigDecimal score, BigDecimal weight, BigDecimal totalWeight) {
        if (score == null || weight == null || totalWeight == null || totalWeight.signum() == 0) return null;
        return scale(score.multiply(weight).divide(totalWeight, 10, RoundingMode.HALF_UP));
    }

    /**
     * Điểm BSC đơn vị = Σ điểm BSC chỉ tiêu, chuẩn hóa theo Σ trọng số các KPI đã có điểm [GIẢ ĐỊNH]
     * (≡ Σ score×w / Σw đã chấm) — chưa có điểm nào → null.
     */
    public static BigDecimal bscUnit(List<WeightedScore> items) {
        BigDecimal num = BigDecimal.ZERO, den = BigDecimal.ZERO;
        for (WeightedScore w : items) {
            if (w.score() == null || w.weight() == null) continue;
            num = num.add(w.score().multiply(w.weight()));
            den = den.add(w.weight());
        }
        return den.signum() == 0 ? null : scale(num.divide(den, 10, RoundingMode.HALF_UP));
    }

    /** KPI cha – con: điểm KPI cha = trung bình có trọng số điểm KPI con (trọng số con nội bộ) [GIẢ ĐỊNH] */
    public static BigDecimal parentScore(List<WeightedScore> children) {
        return bscUnit(children);
    }

    // ============================== 6.7 Kết quả cấp Tập đoàn ==============================
    public record UnitValue(BigDecimal value, BigDecimal weight) {}

    public static BigDecimal aggregate(String method, List<UnitValue> values, String expression, Map<String, BigDecimal> namedValues) {
        List<UnitValue> vs = values.stream().filter(v -> v.value() != null).toList();
        if ("CONG_THUC".equals(method)) {
            FormulaEvaluator.Result r = FormulaEvaluator.eval(expression, namedValues);
            return scale(r.value());
        }
        if (vs.isEmpty()) return null;
        return scale(switch (method) {
            case "TONG" -> vs.stream().map(UnitValue::value).reduce(BigDecimal.ZERO, BigDecimal::add);
            case "TRUNG_BINH" -> vs.stream().map(UnitValue::value).reduce(BigDecimal.ZERO, BigDecimal::add)
                    .divide(BigDecimal.valueOf(vs.size()), 10, RoundingMode.HALF_UP);
            case "TRUNG_BINH_TRONG_SO" -> {
                BigDecimal num = BigDecimal.ZERO, den = BigDecimal.ZERO;
                for (UnitValue v : vs) {
                    BigDecimal w = v.weight() == null ? BigDecimal.ZERO : v.weight();
                    num = num.add(v.value().multiply(w));
                    den = den.add(w);
                }
                yield den.signum() == 0 ? null : num.divide(den, 10, RoundingMode.HALF_UP);
            }
            case "LON_NHAT" -> vs.stream().map(UnitValue::value).max(BigDecimal::compareTo).orElse(null);
            case "NHO_NHAT" -> vs.stream().map(UnitValue::value).min(BigDecimal::compareTo).orElse(null);
            default -> null; // NHAP_TAY: lấy dòng của đơn vị “Công ty mẹ – Tập đoàn”
        });
    }

    // ============================== 6.8 Giai đoạn ==============================
    public record YearPair(BigDecimal actual, BigDecimal plan) {}

    /** % TH/KH giai đoạn = Σ TH / Σ KH các năm trong giai đoạn đến năm đang xem */
    public static BigDecimal stageCompletion(List<YearPair> years) {
        BigDecimal th = BigDecimal.ZERO, kh = BigDecimal.ZERO;
        boolean any = false;
        for (YearPair y : years) {
            if (y.actual() == null || y.plan() == null) continue;
            th = th.add(y.actual());
            kh = kh.add(y.plan());
            any = true;
        }
        return !any || kh.signum() == 0 ? null : scale(th.multiply(HUNDRED).divide(kh, 10, RoundingMode.HALF_UP));
    }

    /** Điểm BSC giai đoạn = trung bình điểm BSC các năm đã có kết quả [GIẢ ĐỊNH] */
    public static BigDecimal stageBsc(List<BigDecimal> yearScores) {
        List<BigDecimal> v = yearScores.stream().filter(java.util.Objects::nonNull).toList();
        if (v.isEmpty()) return null;
        return scale(v.stream().reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(v.size()), 10, RoundingMode.HALF_UP));
    }

    // ============================== 6.9 Xếp hạng ==============================
    public record RankItem(Long unitId, String unitCode, BigDecimal bsc, BigDecimal completion) {}

    /** Xếp theo bsc giảm dần; bằng điểm → % TH/KH giảm dần → mã đơn vị */
    public static Map<Long, Integer> rank(List<RankItem> items) {
        List<RankItem> sorted = new ArrayList<>(items);
        sorted.sort((a, b) -> {
            int c = cmpDesc(a.bsc(), b.bsc());
            if (c != 0) return c;
            c = cmpDesc(a.completion(), b.completion());
            if (c != 0) return c;
            return String.valueOf(a.unitCode()).compareTo(String.valueOf(b.unitCode()));
        });
        Map<Long, Integer> out = new HashMap<>();
        for (int i = 0; i < sorted.size(); i++) out.put(sorted.get(i).unitId(), i + 1);
        return out;
    }

    /** Biến động = prev_rank − rank (dương là tăng hạng) */
    public static Integer movement(Integer prevRank, Integer rank) {
        return prevRank == null || rank == null ? null : prevRank - rank;
    }

    // ============================== tiện ích ==============================
    private static int cmpDesc(BigDecimal a, BigDecimal b) {
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        return b.compareTo(a);
    }

    static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }

    static BigDecimal nzOr(BigDecimal v, int d) { return v == null ? BigDecimal.valueOf(d) : v; }

    static BigDecimal bd(int v) { return BigDecimal.valueOf(v); }

    public static BigDecimal scale(BigDecimal v) { return v == null ? null : v.setScale(SCALE, RoundingMode.HALF_UP); }
}
