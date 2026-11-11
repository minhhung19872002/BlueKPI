# Phần mềm quản trị và theo dõi chỉ tiêu KPI theo BSC — VNPT

Stack: React 19 + TypeScript 5 + Vite (frontend) · Java 21 + Spring Boot 3.5 + MyBatis + MariaDB 10.11 + MinIO + Quartz (backend).
Đặc tả: `docs/SPEC.md` · Quy tắc: `CLAUDE.md` · Truy vết: `docs/TRACEABILITY.md`.

## Chạy môi trường dev

```bash
docker compose -f deploy/docker-compose.dev.yml up -d      # MariaDB:3307, MinIO:9100/9101, Mailpit:8026, mock CAS:8091, mock KPI:8092
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev   # http://localhost:8088/api
cd frontend && npm i && npm run dev                        # http://localhost:5173
```

## Kiểm thử

```bash
cd backend && ./mvnw verify                          # unit + integration (Testcontainers)
cd frontend && npm run lint && npm run test && npm run e2e
```

E2E khởi động backend (cổng 8089, DB `kpi_bsc_e2e` được reset) và `vite preview` (cổng 4174). Cần `JAVA_HOME` trỏ JDK 21 và đã build `backend/target/kpi-bsc-1.0.0.jar`.

## Tài khoản dev (CHỈ DÙNG MÔI TRƯỜNG DEV — production phải đổi)

Mật khẩu mọi tài khoản: **`Kpi@2026`**

| Tài khoản | Vai trò |
|---|---|
| admin | Admin hệ thống |
| lanhdao | Lãnh đạo Tập đoàn |
| tgd | Tổng giám đốc |
| admintd | Admin Tập đoàn/Admin |
| qtgiao | Quản trị và Tổng hợp giao KPI |
| qtthamdinh | Quản trị và tổng hợp thẩm định kết quả thực hiện |
| giaokpi | Giao KPI |
| phoihop | Phối hợp KPI |
| danhgia | Đánh giá KPI |
| lapchienluoc | Lập chiến lược |
| tinh_hni, tinh_hcm | Người dùng đơn vị (VNPT Hà Nội / TP. Hồ Chí Minh) |
| khoa_test / ngung_test | Tài khoản bị khóa / ngưng (kiểm thử 1.2) |
