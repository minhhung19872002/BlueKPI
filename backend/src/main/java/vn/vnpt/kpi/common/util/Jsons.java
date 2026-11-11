package vn.vnpt.kpi.common.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import java.util.Set;

public final class Jsons {
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

    /** Trường nhạy cảm không bao giờ ghi vào log/audit (CLAUDE.md §4.4) */
    private static final Set<String> SENSITIVE = Set.of("password", "passwordHash", "password_hash", "initialPassword",
            "token", "accessToken", "refreshToken", "ticket", "secret", "configValueSecret", "phone");

    private Jsons() {}

    public static ObjectMapper mapper() { return MAPPER; }

    public static String toJson(Object o) {
        if (o == null) return null;
        try {
            return MAPPER.writeValueAsString(o);
        } catch (JsonProcessingException e) {
            return "{\"error\":\"serialize\"}";
        }
    }

    /** JSON đã che các trường nhạy cảm */
    public static String toMaskedJson(Object o) {
        if (o == null) return null;
        JsonNode node = MAPPER.valueToTree(o);
        mask(node);
        return node.toString();
    }

    private static void mask(JsonNode node) {
        if (node == null) return;
        if (node.isObject()) {
            var obj = (com.fasterxml.jackson.databind.node.ObjectNode) node;
            var names = new java.util.ArrayList<String>();
            obj.fieldNames().forEachRemaining(names::add);
            for (String f : names) {
                if (SENSITIVE.contains(f)) obj.put(f, "***");
                else mask(obj.get(f));
            }
        } else if (node.isArray()) {
            node.forEach(Jsons::mask);
        }
    }

    public static <T> T fromJson(String json, Class<T> type) {
        if (json == null || json.isBlank()) return null;
        try {
            return MAPPER.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("JSON không hợp lệ", e);
        }
    }

    public static <T> T fromJson(String json, TypeReference<T> type) {
        if (json == null || json.isBlank()) return null;
        try {
            return MAPPER.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("JSON không hợp lệ", e);
        }
    }

    public static boolean isValidJson(String json) {
        try {
            MAPPER.readTree(json);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
