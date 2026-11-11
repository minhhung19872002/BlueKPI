package vn.vnpt.kpi.engine;

import com.ezylang.evalex.EvaluationException;
import com.ezylang.evalex.Expression;
import com.ezylang.evalex.config.ExpressionConfiguration;
import com.ezylang.evalex.data.EvaluationValue;
import com.ezylang.evalex.functions.basic.AverageFunction;
import com.ezylang.evalex.parser.ASTNode;
import com.ezylang.evalex.parser.ParseException;
import com.ezylang.evalex.parser.Token;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Đánh giá biểu thức có biến bằng EvalEx 3 (PHẦN B §6.2). Hàm thuần, không phụ thuộc Spring.
 * Hỗ trợ: + - * /, SUM, AVG, MIN, MAX, IF, ROUND (và ABS, COALESCE). Chia cho 0 → null + lỗi.
 */
public final class FormulaEvaluator {
    public static final Set<String> ALLOWED_FUNCTIONS = Set.of("SUM", "AVG", "AVERAGE", "MIN", "MAX", "IF", "ROUND", "ABS", "COALESCE");

    private static final ExpressionConfiguration CONFIG = ExpressionConfiguration.builder()
            .mathContext(new MathContext(34, RoundingMode.HALF_UP))
            .decimalPlacesRounding(10)
            .build()
            .withAdditionalFunctions(Map.entry("AVG", new AverageFunction()));

    private FormulaEvaluator() {}

    public record Result(BigDecimal value, String error) {
        public boolean ok() { return error == null; }
    }

    public record Validation(boolean valid, List<String> errors, Set<String> variables) {}

    /** Biến null coi như không có kết quả → kết quả null */
    public static Result eval(String expression, Map<String, BigDecimal> vars) {
        if (expression == null || expression.isBlank()) return new Result(null, "Biểu thức trống");
        try {
            Expression e = new Expression(expression.trim(), CONFIG);
            for (String v : e.getUsedVariables()) {
                BigDecimal val = lookup(vars, v);
                if (val == null) return new Result(null, null);
                e.with(v, val);
            }
            EvaluationValue r = e.evaluate();
            if (r.isBooleanValue()) return new Result(r.getBooleanValue() ? BigDecimal.ONE : BigDecimal.ZERO, null);
            if (!r.isNumberValue()) return new Result(null, "Kết quả biểu thức không phải là số");
            return new Result(r.getNumberValue(), null);
        } catch (EvaluationException ex) {
            String m = ex.getMessage() == null ? "" : ex.getMessage();
            if (m.toLowerCase(Locale.ROOT).contains("division by zero")) return new Result(null, "Chia cho 0");
            return new Result(null, "Lỗi tính biểu thức: " + m);
        } catch (ParseException ex) {
            return new Result(null, "Biểu thức không hợp lệ: " + ex.getMessage());
        } catch (ArithmeticException ex) {
            return new Result(null, ex.getMessage() != null && ex.getMessage().contains("zero") ? "Chia cho 0" : "Lỗi số học");
        }
    }

    /** Kiểm tra cú pháp, hàm được phép, và biến ∈ allowed (null = không giới hạn) */
    public static Validation validate(String expression, Set<String> allowedVars) {
        List<String> errors = new ArrayList<>();
        Set<String> used = new LinkedHashSet<>();
        if (expression == null || expression.isBlank()) return new Validation(false, List.of("Biểu thức trống"), used);
        try {
            Expression e = new Expression(expression.trim(), CONFIG);
            e.validate();
            used.addAll(e.getUsedVariables());
            for (ASTNode n : e.getAllASTNodes()) {
                Token t = n.getToken();
                if (t.getType() == Token.TokenType.FUNCTION && !ALLOWED_FUNCTIONS.contains(t.getValue().toUpperCase(Locale.ROOT))) {
                    errors.add("Hàm không được hỗ trợ: " + t.getValue());
                }
            }
            if (allowedVars != null) {
                for (String v : used) {
                    if (allowedVars.stream().noneMatch(a -> a.equalsIgnoreCase(v))) errors.add("Biến không xác định: " + v);
                }
            }
        } catch (ParseException ex) {
            errors.add("Biểu thức không hợp lệ: " + ex.getMessage());
        }
        return new Validation(errors.isEmpty(), errors, used);
    }

    private static BigDecimal lookup(Map<String, BigDecimal> vars, String name) {
        if (vars.containsKey(name)) return vars.get(name);
        for (Map.Entry<String, BigDecimal> e : vars.entrySet()) if (e.getKey().equalsIgnoreCase(name)) return e.getValue();
        return null;
    }
}
