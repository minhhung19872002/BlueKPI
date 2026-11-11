package vn.vnpt.kpi.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Gọi CAS serviceValidate (2.0) / p3/serviceValidate (3.0), parse XML lấy user + attributes.
 * Parser XML cấu hình chống XXE.
 */
@Slf4j
@Component
public class CasTicketValidator {
    private final CasProperties props;
    private final RestClient client;

    public record CasPrincipal(String user, Map<String, String> attributes) {}

    public CasTicketValidator(CasProperties props) {
        this.props = props;
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(5000);
        f.setReadTimeout(10000);
        this.client = RestClient.builder().requestFactory(f).build();
    }

    public CasPrincipal validate(String ticket) {
        String url = UriComponentsBuilder.fromUriString(props.validateUrl())
                .queryParam("ticket", ticket).queryParam("service", props.serviceUrl())
                .encode().toUriString();
        String xml;
        try {
            xml = client.get().uri(java.net.URI.create(url)).retrieve().body(String.class);
        } catch (Exception e) {
            log.warn("Không gọi được CAS validate: {}", e.getMessage());
            throw new BusinessException(ErrorCode.ERR_INTEGRATION, "Không kết nối được máy chủ VNPT SSO");
        }
        return parse(xml);
    }

    static CasPrincipal parse(String xml) {
        try {
            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            dbf.setNamespaceAware(true);
            dbf.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
            dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            dbf.setXIncludeAware(false);
            dbf.setExpandEntityReferences(false);
            Document doc = dbf.newDocumentBuilder().parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
            String ns = "http://www.yale.edu/tp/cas";
            NodeList success = doc.getElementsByTagNameNS(ns, "authenticationSuccess");
            if (success.getLength() == 0) throw new BusinessException(ErrorCode.ERR_UNAUTHORIZED, "Ticket SSO không hợp lệ hoặc đã hết hạn");
            Element s = (Element) success.item(0);
            String user = s.getElementsByTagNameNS(ns, "user").item(0).getTextContent().trim();
            Map<String, String> attrs = new HashMap<>();
            NodeList attrNodes = s.getElementsByTagNameNS(ns, "attributes");
            if (attrNodes.getLength() > 0) {
                NodeList children = attrNodes.item(0).getChildNodes();
                for (int i = 0; i < children.getLength(); i++) {
                    if (children.item(i) instanceof Element e) attrs.put(e.getLocalName(), e.getTextContent().trim());
                }
            }
            return new CasPrincipal(user, attrs);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.ERR_INTEGRATION, "Phản hồi VNPT SSO không hợp lệ");
        }
    }
}
