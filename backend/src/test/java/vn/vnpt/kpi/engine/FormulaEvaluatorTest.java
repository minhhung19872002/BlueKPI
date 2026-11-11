package vn.vnpt.kpi.engine;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class FormulaEvaluatorTest {

    @ParameterizedTest(name = "{0} = {1}")
    @CsvSource(delimiter = '|', value = {
            "A + B | 30",
            "A - B | -10",
            "A * B | 200",
            "B / A | 2",
            "SUM(A, B, 5) | 35",
            "AVG(A, B) | 15",
            "MIN(A, B) | 10",
            "MAX(A, B) | 20",
            "IF(A > B, A, B) | 20",
            "ROUND(B / 3, 2) | 6.67",
            "a + b | 30"})
    void evaluates(String expr, String expected) {
        var r = FormulaEvaluator.eval(expr, Map.of("A", new BigDecimal("10"), "B", new BigDecimal("20")));
        assertThat(r.ok()).isTrue();
        assertThat(r.value()).isEqualByComparingTo(expected);
    }

    @Test
    void divisionByZeroGivesNullAndError() {
        var r = FormulaEvaluator.eval("A / B", Map.of("A", BigDecimal.ONE, "B", BigDecimal.ZERO));
        assertThat(r.value()).isNull();
        assertThat(r.error()).isEqualTo("Chia cho 0");
    }

    @Test
    void missingVariableGivesNullWithoutError() {
        Map<String, BigDecimal> vars = new HashMap<>();
        vars.put("A", null);
        var r = FormulaEvaluator.eval("A + 1", vars);
        assertThat(r.value()).isNull();
        assertThat(r.error()).isNull();
    }

    @Test
    void validateRejectsUnknownFunctionAndVariable() {
        var v = FormulaEvaluator.validate("SQRT(A) + C", Set.of("A", "B"));
        assertThat(v.valid()).isFalse();
        assertThat(v.errors()).anyMatch(e -> e.contains("SQRT")).anyMatch(e -> e.contains("C"));
        assertThat(FormulaEvaluator.validate("(A + ", Set.of("A")).valid()).isFalse();
        assertThat(FormulaEvaluator.validate("TH / KH * 100", Set.of("TH", "KH", "KH_NAM")).valid()).isTrue();
    }
}
