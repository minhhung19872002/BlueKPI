package vn.vnpt.kpi.engine;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import vn.vnpt.kpi.engine.KpiCalculationEngine.ComponentIn;
import vn.vnpt.kpi.engine.KpiCalculationEngine.Config;
import vn.vnpt.kpi.engine.KpiCalculationEngine.Input;
import vn.vnpt.kpi.engine.KpiCalculationEngine.Output;
import vn.vnpt.kpi.engine.KpiCalculationEngine.RankItem;
import vn.vnpt.kpi.engine.KpiCalculationEngine.Scoring;
import vn.vnpt.kpi.engine.KpiCalculationEngine.UnitValue;
import vn.vnpt.kpi.engine.KpiCalculationEngine.WeightedScore;
import vn.vnpt.kpi.engine.KpiCalculationEngine.YearPair;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** ≥ 40 ca bảng-dữ-liệu cho KpiCalculationEngine (PHẦN B §6) */
class KpiCalculationEngineTest {
    static final Config CFG = Config.defaults();

    static BigDecimal d(String s) { return s == null || s.isBlank() ? null : new BigDecimal(s.trim()); }

    static Scoring scoring(String t) {
        return switch (t) {
            case "DKD" -> Scoring.datKhongDat();
            case "ND" -> Scoring.nhapDiem();
            default -> Scoring.defaultBands();
        };
    }

    /**
     * Cột: ca | công thức | biểu thức TL | biểu thức KQ | PP điểm | theo KQ | điểm tay | KH | KH năm | A | B | ĐC trước | ĐC |
     * kỳ vọng: KQ cuối | % TH/KH | điểm | phân loại
     */
    @ParameterizedTest(name = "[{index}] {0}")
    @CsvSource(delimiter = '|', nullValues = "~", value = {
            // ---- THUAN + biên khung điểm (from ≤ % < to) ----
            "Thuận 50%            | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 50     | ~ | 0 | 0 | 50.0000  | 50.0000  | 1 | CHUA_DAT",
            "Thuận 69.99%         | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 69.99  | ~ | 0 | 0 | 69.9900  | 69.9900  | 1 | CHUA_DAT",
            "Thuận biên 70%       | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 70     | ~ | 0 | 0 | 70.0000  | 70.0000  | 2 | CHUA_DAT",
            "Thuận 84.9999%       | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 84.9999| ~ | 0 | 0 | 84.9999  | 84.9999  | 2 | CHUA_DAT",
            "Thuận biên 85%       | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 85     | ~ | 0 | 0 | 85.0000  | 85.0000  | 3 | DAT_VUOT",
            "Thuận 99.99%         | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 99.99  | ~ | 0 | 0 | 99.9900  | 99.9900  | 3 | DAT_VUOT",
            "Thuận biên 100%      | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 100    | ~ | 0 | 0 | 100.0000 | 100.0000 | 4 | DAT_VUOT",
            "Thuận 109.99%        | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 109.99 | ~ | 0 | 0 | 109.9900 | 109.9900 | 4 | DAT_VUOT",
            "Thuận biên 110%      | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 110    | ~ | 0 | 0 | 110.0000 | 110.0000 | 5 | DAT_VUOT",
            "Thuận 250%           | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 250    | ~ | 0 | 0 | 250.0000 | 250.0000 | 5 | DAT_VUOT",
            "Thuận TH = 0         | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 0      | ~ | 0 | 0 | 0.0000   | 0.0000   | 1 | CHUA_DAT",
            "Thuận KH = 0         | THUAN | ~ | A | KTL | true | ~ | 0   | 400 | 50     | ~ | 0 | 0 | 50.0000  | ~        | ~ | DANG_THEO_DOI",
            "Thuận KH null        | THUAN | ~ | A | KTL | true | ~ | ~   | 400 | 50     | ~ | 0 | 0 | 50.0000  | ~        | ~ | DANG_THEO_DOI",
            "Thuận chưa có KQ     | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | ~      | ~ | 0 | 0 | ~        | ~        | ~ | DANG_THEO_DOI",
            "Thuận KH lẻ làm tròn | THUAN | ~ | A | KTL | true | ~ | 3   | 12  | 1      | ~ | 0 | 0 | 1.0000   | 33.3333  | 1 | CHUA_DAT",
            "Thuận 2/3 làm tròn   | THUAN | ~ | A | KTL | true | ~ | 3   | 12  | 2      | ~ | 0 | 0 | 2.0000   | 66.6667  | 1 | CHUA_DAT",
            "Thuận âm             | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | -10    | ~ | 0 | 0 | -10.0000 | -10.0000 | 1 | CHUA_DAT",
            // ---- NGHICH ----
            "Nghịch KH/TH 100%    | NGHICH | ~ | A | KTL | true | ~ | 5  | 5  | 5      | ~ | 0 | 0 | 5.0000   | 100.0000 | 4 | DAT_VUOT",
            "Nghịch tốt hơn KH    | NGHICH | ~ | A | KTL | true | ~ | 5  | 5  | 4      | ~ | 0 | 0 | 4.0000   | 125.0000 | 5 | DAT_VUOT",
            "Nghịch kém hơn KH    | NGHICH | ~ | A | KTL | true | ~ | 5  | 5  | 8      | ~ | 0 | 0 | 8.0000   | 62.5000  | 1 | CHUA_DAT",
            "Nghịch TH = 0 → trần | NGHICH | ~ | A | KTL | true | ~ | 5  | 5  | 0      | ~ | 0 | 0 | 0.0000   | 200      | 5 | DAT_VUOT",
            "Nghịch KH null       | NGHICH | ~ | A | KTL | true | ~ | ~  | 5  | 3      | ~ | 0 | 0 | 3.0000   | ~        | ~ | DANG_THEO_DOI",
            "Nghịch 3/7           | NGHICH | ~ | A | KTL | true | ~ | 3  | 3  | 7      | ~ | 0 | 0 | 7.0000   | 42.8571  | 1 | CHUA_DAT",
            // ---- TUY_CHINH ----
            "Tùy chỉnh TH/KH×100  | TUY_CHINH | TH / KH * 100     | A | KTL | true | ~ | 80 | 320 | 80  | ~ | 0 | 0 | 80.0000 | 100.0000 | 4 | DAT_VUOT",
            "Tùy chỉnh theo năm   | TUY_CHINH | TH / KH_NAM * 400 | A | KTL | true | ~ | 80 | 320 | 72  | ~ | 0 | 0 | 72.0000 | 90.0000  | 3 | DAT_VUOT",
            "Tùy chỉnh IF trần    | TUY_CHINH | MIN(TH / KH * 100, 120) | A | KTL | true | ~ | 50 | 200 | 100 | ~ | 0 | 0 | 100.0000 | 120.0000 | 5 | DAT_VUOT",
            "Tùy chỉnh chia 0     | TUY_CHINH | TH / KH * 100     | A | KTL | true | ~ | 0  | 0   | 10  | ~ | 0 | 0 | 10.0000 | ~        | ~ | DANG_THEO_DOI",
            // ---- Nhiều thành phần / biểu thức ----
            "A + B                | THUAN | ~ | A + B       | KTL | true | ~ | 100 | 400 | 60 | 45 | 0 | 0 | 105.0000 | 105.0000 | 4 | DAT_VUOT",
            "A / B × 100          | THUAN | ~ | A / B * 100 | KTL | true | ~ | 90  | 90  | 45 | 50 | 0 | 0 | 90.0000  | 100.0000 | 4 | DAT_VUOT",
            "A / B chia 0         | THUAN | ~ | A / B       | KTL | true | ~ | 90  | 90  | 45 | 0  | 0 | 0 | ~        | ~        | ~ | DANG_THEO_DOI",
            "Thiếu thành phần B   | THUAN | ~ | A + B       | KTL | true | ~ | 100 | 400 | 60 | ~  | 0 | 0 | ~        | ~        | ~ | DANG_THEO_DOI",
            "SUM ROUND            | THUAN | ~ | ROUND(SUM(A, B) / 3, 2) | KTL | true | ~ | 10 | 40 | 10 | 10 | 0 | 0 | 6.6700 | 66.7000 | 1 | CHUA_DAT",
            "AVG                  | THUAN | ~ | AVG(A, B)   | KTL | true | ~ | 50  | 200 | 40 | 60 | 0 | 0 | 50.0000  | 100.0000 | 4 | DAT_VUOT",
            // ---- Điều chỉnh / ĐC kỳ trước (LŨY KẾ) ----
            "Điều chỉnh +5        | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 80 | ~ | 0  | 5  | 85.0000  | 85.0000  | 3 | DAT_VUOT",
            "ĐC kỳ trước +10      | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 80 | ~ | 10 | 0  | 90.0000  | 90.0000  | 3 | DAT_VUOT",
            "ĐC trước + ĐC        | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 80 | ~ | 10 | 25 | 115.0000 | 115.0000 | 5 | DAT_VUOT",
            "Điều chỉnh âm        | THUAN | ~ | A | KTL | true | ~ | 100 | 400 | 80 | ~ | 0  | -15| 65.0000  | 65.0000  | 1 | CHUA_DAT",
            // ---- DAT_KHONG_DAT / NHAP_DIEM / không tính theo KQ ----
            "Đạt/Không đạt: đạt   | THUAN | ~ | A | DKD | true  | ~   | 100 | 100 | 100 | ~ | 0 | 0 | 100.0000 | 100.0000 | 5 | DAT_VUOT",
            "Đạt/Không đạt: trượt | THUAN | ~ | A | DKD | true  | ~   | 100 | 100 | 99  | ~ | 0 | 0 | 99.0000  | 99.0000  | 1 | CHUA_DAT",
            "Nhập điểm 4          | THUAN | ~ | A | ND  | true  | 4   | 100 | 100 | 50  | ~ | 0 | 0 | 50.0000  | 50.0000  | 4 | DAT_VUOT",
            "Nhập điểm trống      | THUAN | ~ | A | ND  | true  | ~   | 100 | 100 | 50  | ~ | 0 | 0 | 50.0000  | 50.0000  | ~ | DANG_THEO_DOI",
            "Không theo KQ: tay 2 | THUAN | ~ | A | KTL | false | 2   | 100 | 100 | 150 | ~ | 0 | 0 | 150.0000 | 150.0000 | 2 | CHUA_DAT",
            "Không theo KQ: biên 3| THUAN | ~ | A | KTL | false | 3   | 100 | 100 | 10  | ~ | 0 | 0 | 10.0000  | 10.0000  | 3 | DAT_VUOT",
    })
    void calculate(String name, String formula, String cexpr, String rexpr, String scoringType, boolean byResult, String manual,
                   String plan, String yearPlan, String a, String b, String prevAdj, String adj,
                   String expFinal, String expRate, String expScore, String expRating) {
        List<ComponentIn> comps = new ArrayList<>();
        comps.add(new ComponentIn("A", d(a), null, null));
        if (rexpr.contains("B")) comps.add(new ComponentIn("B", d(b), null, null));
        Input in = new Input(formula, cexpr, rexpr, scoring(scoringType), byResult, d(manual), d(plan), d(yearPlan), comps, d(prevAdj), d(adj));
        Output o = KpiCalculationEngine.calculate(in, CFG);
        assertEq(o.finalResult(), expFinal, "Kết quả cuối");
        assertEq(o.completionRate(), expRate, "% TH/KH");
        assertEq(o.score(), expScore, "Điểm");
        assertThat(o.rating()).as(name).isEqualTo(expRating);
    }

    static void assertEq(BigDecimal actual, String expected, String label) {
        if (expected == null) assertThat(actual).as(label).isNull();
        else assertThat(actual).as(label).isNotNull().isEqualByComparingTo(expected);
    }

    @Test
    void divisionByZeroMarksError() {
        Output o = KpiCalculationEngine.calculate(new Input("THUAN", null, "A / B", Scoring.defaultBands(), true, null, d("10"), d("40"),
                List.of(new ComponentIn("A", d("1"), null, null), new ComponentIn("B", d("0"), null, null)), null, null), CFG);
        assertThat(o.error()).isEqualTo("Chia cho 0");
        assertThat(o.hasResult()).isFalse();
    }

    @Test
    void componentFinalValueIncludesAdjustments() {
        Output o = KpiCalculationEngine.calculate(new Input("THUAN", null, "A", Scoring.defaultBands(), true, null, d("100"), d("400"),
                List.of(new ComponentIn("A", d("80"), d("5"), d("3"))), null, null), CFG);
        assertThat(o.components().get(0).finalValue()).isEqualByComparingTo("88");
        assertThat(o.finalResult()).isEqualByComparingTo("88");
    }

    @Test
    void yearCompletionRate() {
        Output o = KpiCalculationEngine.calculate(new Input("THUAN", null, "A", Scoring.defaultBands(), true, null, d("25"), d("100"),
                List.of(new ComponentIn("A", d("30"), null, null)), null, null), CFG);
        assertThat(o.yearCompletionRate()).isEqualByComparingTo("30");
        assertThat(o.completionRate()).isEqualByComparingTo("120");
    }

    @Test
    void warningFlag() {
        Output o = KpiCalculationEngine.calculate(new Input("THUAN", null, "A", Scoring.defaultBands(), true, null, d("100"), d("100"),
                List.of(new ComponentIn("A", d("88"), null, null)), null, null), CFG);
        assertThat(o.rating()).isEqualTo("DAT_VUOT");
        assertThat(o.warning()).isTrue(); // 88 < KPI_WARNING_RATE 90
    }

    @Test
    void configurablePassScore() {
        Config strict = new Config(d("4"), d("90"), d("200"));
        Output o = KpiCalculationEngine.calculate(new Input("THUAN", null, "A", Scoring.defaultBands(), true, null, d("100"), d("100"),
                List.of(new ComponentIn("A", d("95"), null, null)), null, null), strict);
        assertThat(o.score()).isEqualByComparingTo("3");
        assertThat(o.rating()).isEqualTo("CHUA_DAT");
    }

    @Test
    void prevAdjustmentOnlyForCumulative() {
        assertThat(KpiCalculationEngine.prevAdjustment("LUY_KE", List.of(d("2"), d("3")))).isEqualByComparingTo("5");
        assertThat(KpiCalculationEngine.prevAdjustment("THEO_KY", List.of(d("2"), d("3")))).isEqualByComparingTo("0");
        assertThat(KpiCalculationEngine.prevAdjustment("LUY_KE", List.of())).isEqualByComparingTo("0");
    }

    @Test
    void bscItemAndUnit() {
        assertThat(KpiCalculationEngine.bscItem(d("4"), d("15"), d("100"))).isEqualByComparingTo("0.6");
        assertThat(KpiCalculationEngine.bscItem(null, d("15"), d("100"))).isNull();
        assertThat(KpiCalculationEngine.bscUnit(List.of(new WeightedScore(d("4"), d("60")), new WeightedScore(d("2"), d("40"))))).isEqualByComparingTo("3.2");
        // KPI chưa có điểm không làm giảm điểm (chuẩn hóa theo trọng số đã chấm)
        assertThat(KpiCalculationEngine.bscUnit(List.of(new WeightedScore(d("5"), d("50")), new WeightedScore(null, d("50"))))).isEqualByComparingTo("5");
        assertThat(KpiCalculationEngine.bscUnit(List.of(new WeightedScore(null, d("50"))))).isNull();
    }

    @Test
    void parentChildScore() {
        assertThat(KpiCalculationEngine.parentScore(List.of(new WeightedScore(d("5"), d("50")), new WeightedScore(d("1"), d("50"))))).isEqualByComparingTo("3");
        assertThat(KpiCalculationEngine.parentScore(List.of(new WeightedScore(d("4"), d("70")), new WeightedScore(d("2"), d("30"))))).isEqualByComparingTo("3.4");
    }

    @Test
    void groupAggregation() {
        List<UnitValue> v = List.of(new UnitValue(d("10"), d("1")), new UnitValue(d("20"), d("3")), new UnitValue(null, d("5")));
        assertThat(KpiCalculationEngine.aggregate("TONG", v, null, null)).isEqualByComparingTo("30");
        assertThat(KpiCalculationEngine.aggregate("TRUNG_BINH", v, null, null)).isEqualByComparingTo("15");
        assertThat(KpiCalculationEngine.aggregate("TRUNG_BINH_TRONG_SO", v, null, null)).isEqualByComparingTo("17.5");
        assertThat(KpiCalculationEngine.aggregate("LON_NHAT", v, null, null)).isEqualByComparingTo("20");
        assertThat(KpiCalculationEngine.aggregate("NHO_NHAT", v, null, null)).isEqualByComparingTo("10");
        assertThat(KpiCalculationEngine.aggregate("CONG_THUC", v, "HNI + HCM * 2", Map.of("HNI", d("1"), "HCM", d("4")))).isEqualByComparingTo("9");
        assertThat(KpiCalculationEngine.aggregate("NHAP_TAY", v, null, null)).isNull();
    }

    @Test
    void stageCalculations() {
        assertThat(KpiCalculationEngine.stageCompletion(List.of(new YearPair(d("90"), d("100")), new YearPair(d("120"), d("100"))))).isEqualByComparingTo("105");
        assertThat(KpiCalculationEngine.stageCompletion(List.of(new YearPair(null, d("100"))))).isNull();
        assertThat(KpiCalculationEngine.stageBsc(List.of(d("3"), d("4"), d("5")))).isEqualByComparingTo("4");
        assertThat(KpiCalculationEngine.stageBsc(java.util.Arrays.asList(d("3"), null))).isEqualByComparingTo("3");
    }

    @Test
    void rankingTieBreakAndMovement() {
        var ranks = KpiCalculationEngine.rank(List.of(
                new RankItem(1L, "B", d("4"), d("100")),
                new RankItem(2L, "A", d("4"), d("100")),
                new RankItem(3L, "C", d("4"), d("110")),
                new RankItem(4L, "D", d("5"), d("80")),
                new RankItem(5L, "E", null, null)));
        assertThat(ranks).containsEntry(4L, 1).containsEntry(3L, 2).containsEntry(2L, 3).containsEntry(1L, 4).containsEntry(5L, 5);
        assertThat(KpiCalculationEngine.movement(5, 2)).isEqualTo(3);
        assertThat(KpiCalculationEngine.movement(1, 3)).isEqualTo(-2);
        assertThat(KpiCalculationEngine.movement(null, 3)).isNull();
    }
}
