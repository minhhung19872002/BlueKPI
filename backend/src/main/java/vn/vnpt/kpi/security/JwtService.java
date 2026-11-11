package vn.vnpt.kpi.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.HexFormat;
import java.util.List;

/**
 * JWT HS512 (secret ≥ 64 byte). Hỗ trợ xoay vòng khóa: ký bằng khóa hiện tại,
 * xác minh bằng khóa hiện tại hoặc khóa trước đó (PHẦN B §9.4).
 */
@Service
public class JwtService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final SecretKey current;
    private final List<SecretKey> verifyKeys = new ArrayList<>();
    private final JwtProperties props;

    public JwtService(JwtProperties props) {
        this.props = props;
        this.current = toKey(props.jwtSecret());
        verifyKeys.add(current);
        if (props.jwtSecretPrevious() != null && !props.jwtSecretPrevious().isBlank()) {
            verifyKeys.add(toKey(props.jwtSecretPrevious()));
        }
    }

    static SecretKey toKey(String secret) {
        if (secret == null) throw new IllegalStateException("KPI_JWT_SECRET chưa được cấu hình");
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 64) throw new IllegalStateException("KPI_JWT_SECRET phải dài tối thiểu 64 byte (HS512)");
        return Keys.hmacShaKeyFor(bytes);
    }

    public String issueAccessToken(Long userId, String username, Long sessionId, String authMethod) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("usr", username)
                .claim("sid", sessionId)
                .claim("am", authMethod)
                .claim("typ", "access")
                .issuer("kpi-bsc")
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(props.accessTtl())))
                .signWith(current, Jwts.SIG.HS512)
                .compact();
    }

    /** @return claims nếu hợp lệ, null nếu sai chữ ký/hết hạn */
    public Claims parse(String token) {
        for (SecretKey k : verifyKeys) {
            try {
                Claims c = Jwts.parser().verifyWith(k).requireIssuer("kpi-bsc").build().parseSignedClaims(token).getPayload();
                if (!"access".equals(c.get("typ"))) return null;
                return c;
            } catch (JwtException | IllegalArgumentException e) {
                // thử khóa kế tiếp
            }
        }
        return null;
    }

    public static String newRefreshToken() {
        byte[] b = new byte[32];
        RANDOM.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    public static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
