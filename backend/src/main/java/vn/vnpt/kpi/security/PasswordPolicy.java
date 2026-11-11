package vn.vnpt.kpi.security;

/** Chính sách mật khẩu: ≥ 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt (PHẦN B §9.8) */
public final class PasswordPolicy {
    public static final String MESSAGE = "Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt";

    private PasswordPolicy() {}

    public static boolean valid(String p) {
        return p != null && p.length() >= 8 && p.length() <= 128
                && p.chars().anyMatch(Character::isUpperCase)
                && p.chars().anyMatch(Character::isLowerCase)
                && p.chars().anyMatch(Character::isDigit)
                && p.chars().anyMatch(c -> !Character.isLetterOrDigit(c) && !Character.isWhitespace(c));
    }
}
