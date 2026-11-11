package vn.vnpt.kpi.modules.schedule.service;

import java.util.Map;

/** Diễn giải cron Quartz sang tiếng Việt, vd “02:00 hằng ngày” (26.17) */
public final class CronDescriber {
    private static final Map<String, String> DOW = Map.of("SUN", "Chủ nhật", "MON", "Thứ Hai", "TUE", "Thứ Ba", "WED", "Thứ Tư",
            "THU", "Thứ Năm", "FRI", "Thứ Sáu", "SAT", "Thứ Bảy", "1", "Chủ nhật", "2", "Thứ Hai", "3", "Thứ Ba");

    private CronDescriber() {}

    public static String describe(String cron) {
        if (cron == null) return "";
        String[] p = cron.trim().split("\\s+");
        if (p.length != 6) return "Cron nâng cao: " + cron;
        String sec = p[0], min = p[1], hour = p[2], dom = p[3], mon = p[4], dow = p[5];
        if (!isNum(sec) || !isNum(min) || !isNum(hour)) return "Cron nâng cao: " + cron;
        String time = String.format("%02d:%02d", Integer.parseInt(hour), Integer.parseInt(min));
        boolean anyDom = dom.equals("*") || dom.equals("?");
        boolean anyMon = mon.equals("*");
        boolean anyDow = dow.equals("*") || dow.equals("?");
        if (anyDom && anyMon && anyDow) return time + " hằng ngày";
        if (anyDom && anyMon && !anyDow) {
            String[] days = dow.split(",");
            StringBuilder sb = new StringBuilder();
            for (String d : days) {
                if (!sb.isEmpty()) sb.append(", ");
                sb.append(DOW.getOrDefault(d.toUpperCase(), d));
            }
            return time + " hằng tuần (" + sb + ")";
        }
        if (isNum(dom) && anyMon && anyDow) return time + " ngày " + Integer.parseInt(dom) + " hằng tháng";
        if (isNum(dom) && isNum(mon) && anyDow) return String.format("%s ngày %02d/%02d hằng năm", time, Integer.parseInt(dom), Integer.parseInt(mon));
        return "Cron nâng cao: " + cron;
    }

    private static boolean isNum(String s) {
        return s.matches("\\d{1,2}");
    }
}
