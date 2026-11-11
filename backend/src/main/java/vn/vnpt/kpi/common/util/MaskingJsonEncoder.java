package vn.vnpt.kpi.common.util;

import ch.qos.logback.classic.encoder.JsonEncoder;
import ch.qos.logback.classic.spi.ILoggingEvent;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;

/**
 * JsonEncoder (log JSON production) có che token/ticket/mật khẩu như MaskingConverter (PHẦN B §9.7).
 * Bọc event bằng dynamic proxy: getFormattedMessage()/getMessage() trả về chuỗi đã che.
 */
public class MaskingJsonEncoder extends JsonEncoder {

    @Override
    public byte[] encode(ILoggingEvent event) {
        return super.encode(masked(event));
    }

    static ILoggingEvent masked(ILoggingEvent e) {
        return (ILoggingEvent) Proxy.newProxyInstance(ILoggingEvent.class.getClassLoader(), new Class<?>[]{ILoggingEvent.class}, (proxy, m, args) -> {
            switch (m.getName()) {
                case "getFormattedMessage": return MaskingConverter.mask(e.getFormattedMessage());
                case "getMessage": return MaskingConverter.mask(e.getMessage());
                case "getArgumentArray": return null; // tham số thô có thể chứa secret
                default:
                    try {
                        return m.invoke(e, args);
                    } catch (InvocationTargetException ex) {
                        throw ex.getCause();
                    }
            }
        });
    }
}
