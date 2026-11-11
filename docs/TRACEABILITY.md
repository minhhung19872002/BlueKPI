# TRACEABILITY — Bảng truy vết STT → Route FE → Endpoint BE → Quyền → Test e2e

> File sinh tự động bởi `node scripts/gen-traceability.mjs` từ `docs/traceability-data.txt`. Cột “Test e2e” dò tự động trong `frontend/e2e/**/*.spec.ts` (tên test bắt đầu bằng mã STT). ☑ = đã đủ DoD (CLAUDE.md §6) và có e2e.

**Tiến độ chức năng: 0/173 STT ☑**

## 1. Chức năng (PHẦN C)

| STT | Tên | Route FE | Endpoint BE | Quyền | Test e2e | Trạng thái |
|---|---|---|---|---|---|---|
| 1.1 | Đăng nhập hệ thống | `/login` | `POST /api/auth/login` | `(public)` | — | ☐ |
| 1.2 | Đăng nhập – Thông tin không hợp lệ | `/login` | `POST /api/auth/login` | `(public)` | — | ☐ |
| 2.1 | Đăng xuất hệ thống | `(Header)` | `POST /api/auth/logout` | `(authenticated)` | — | ☐ |
| 3.1 | Lấy danh sách – Người dùng | `/system/users` | `GET /api/users` | `USER:VIEW` | — | ☐ |
| 3.2 | Tìm kiếm – Người dùng | `/system/users` | `GET /api/users?keyword&status&orgUnitId` | `USER:VIEW` | — | ☐ |
| 3.3 | Xem chi tiết – Người dùng | `/system/users` | `GET /api/users/{id}` | `USER:VIEW` | — | ☐ |
| 3.4 | Thêm mới – Người dùng | `/system/users` | `POST /api/users` | `USER:CREATE` | — | ☐ |
| 3.5 | Ghi lại – Người dùng | `/system/users` | `PUT /api/users/{id}` | `USER:UPDATE` | — | ☐ |
| 3.6 | Xóa – Người dùng | `/system/users` | `DELETE /api/users/{id}` | `USER:DELETE` | — | ☐ |
| 3.7 | Nhập dữ liệu – Người dùng | `/system/users` | `POST /api/users/import/validate, /commit` | `USER:IMPORT` | — | ☐ |
| 3.8 | Xuất dữ liệu – Người dùng | `/system/users` | `GET /api/users/export` | `USER:EXPORT` | — | ☐ |
| 3.9 | Gán vai trò cho người dùng | `/system/users` | `PUT /api/users/{id}/roles` | `USER:ASSIGN_ROLE` | — | ☐ |
| 3.10 | Bỏ gán vai trò của người dùng | `/system/users` | `PUT /api/users/{id}/roles` | `USER:ASSIGN_ROLE` | — | ☐ |
| 4.1 | Lấy danh sách – Vai trò | `/system/roles` | `GET /api/roles` | `ROLE:VIEW` | — | ☐ |
| 4.2 | Tìm kiếm – Vai trò | `/system/roles` | `GET /api/roles?keyword&status` | `ROLE:VIEW` | — | ☐ |
| 4.3 | Xem chi tiết – Vai trò | `/system/roles` | `GET /api/roles/{id}, GET /api/roles/{id}/permissions` | `ROLE:VIEW` | — | ☐ |
| 4.4 | Thêm mới – Vai trò | `/system/roles` | `POST /api/roles` | `ROLE:CREATE` | — | ☐ |
| 4.5 | Ghi lại – Vai trò | `/system/roles` | `PUT /api/roles/{id}` | `ROLE:UPDATE` | — | ☐ |
| 4.6 | Xóa – Vai trò | `/system/roles` | `DELETE /api/roles/{id}` | `ROLE:DELETE` | — | ☐ |
| 4.7 | Lấy danh sách – Quyền | `/system/permissions` | `GET /api/permissions` | `PERMISSION:VIEW` | — | ☐ |
| 4.8 | Xem chi tiết – Quyền | `/system/permissions` | `GET /api/permissions/{id}` | `PERMISSION:VIEW` | — | ☐ |
| 4.9 | Ghi lại – Quyền | `/system/permissions` | `PUT /api/permissions/{id}` | `PERMISSION:UPDATE` | — | ☐ |
| 5.1 | Lấy danh sách – Đơn vị | `/system/org-units` | `GET /api/org-units, GET /api/org-units/tree` | `ORG:VIEW` | — | ☐ |
| 5.2 | Tìm kiếm – Đơn vị | `/system/org-units` | `GET /api/org-units?keyword&unitType&regionCode` | `ORG:VIEW` | — | ☐ |
| 5.3 | Xem chi tiết – Đơn vị | `/system/org-units` | `GET /api/org-units/{id}` | `ORG:VIEW` | — | ☐ |
| 5.4 | Thêm mới – Đơn vị | `/system/org-units` | `POST /api/org-units` | `ORG:CREATE` | — | ☐ |
| 5.5 | Ghi lại – Đơn vị | `/system/org-units` | `PUT /api/org-units/{id}` | `ORG:UPDATE` | — | ☐ |
| 5.6 | Xóa – Đơn vị | `/system/org-units` | `DELETE /api/org-units/{id}` | `ORG:DELETE` | — | ☐ |
| 5.7 | Nhập dữ liệu – Đơn vị | `/system/org-units` | `POST /api/org-units/import/validate, /commit` | `ORG:IMPORT` | — | ☐ |
| 5.8 | Xuất dữ liệu – Đơn vị | `/system/org-units` | `GET /api/org-units/export` | `ORG:EXPORT` | — | ☐ |
| 6.1 | Xem biểu tổng hợp Tập đoàn – Năm | `/dashboard?unit=GROUP&period=Y` | `GET /api/dashboard/overview, /ranking-provinces, /corporations` | `DASHBOARD:VIEW_GROUP` | — | ☐ |
| 7.1 | Xem biểu tổng hợp Tập đoàn – Quý | `/dashboard?unit=GROUP&period=Q1..Q4` | `GET /api/dashboard/overview` | `DASHBOARD:VIEW_GROUP` | — | ☐ |
| 8.1 | Xem biểu tổng hợp Tập đoàn – Giai đoạn | `/dashboard?unit=GROUP&period=STAGE_x` | `GET /api/dashboard/overview` | `DASHBOARD:VIEW_GROUP` | — | ☐ |
| 9.1 | Xem biểu tổng hợp Đơn vị – Năm | `/dashboard?unit={id}&period=Y` | `GET /api/dashboard/overview` | `DASHBOARD:VIEW_UNIT` | — | ☐ |
| 10.1 | Xem biểu tổng hợp Đơn vị – Quý | `/dashboard?unit={id}&period=Qn` | `GET /api/dashboard/overview` | `DASHBOARD:VIEW_UNIT` | — | ☐ |
| 11.1 | Xem biểu tổng hợp Đơn vị – Giai đoạn | `/dashboard?unit={id}&period=STAGE_x` | `GET /api/dashboard/overview` | `DASHBOARD:VIEW_UNIT` | — | ☐ |
| 12.1 | Xem biểu tổng hợp Tỉnh – Năm (tất cả các tỉnh) | `/dashboard?unit=PROVINCES&period=Y` | `GET /api/dashboard/ranking-provinces` | `DASHBOARD:VIEW_PROVINCE` | — | ☐ |
| 13.1 | Xem biểu tổng hợp Tỉnh – Quý (tất cả các tỉnh) | `/dashboard?unit=PROVINCES&period=Qn` | `GET /api/dashboard/ranking-provinces` | `DASHBOARD:VIEW_PROVINCE` | — | ☐ |
| 14.1 | Xem biểu tổng hợp giai đoạn của 1 tỉnh | `/dashboard?unit={id}&period=STAGE_x` | `GET /api/dashboard/province-stage` | `DASHBOARD:VIEW_PROVINCE` | — | ☐ |
| 15.1 | Xem bản đồ chiến lược | `/dashboard (dialog)` | `GET /api/dashboard/strategy-map` | `DASHBOARD:VIEW_UNIT` | — | ☐ |
| 16.1 | Xem Dashboard đơn vị từ bảng xếp hạng | `/dashboard` | `GET /api/dashboard/overview` | `DASHBOARD:VIEW_GROUP` | — | ☐ |
| 16.2 | Quay lại Dashboard Tập đoàn | `/dashboard` | `GET /api/dashboard/overview` | `DASHBOARD:VIEW_GROUP` | — | ☐ |
| 17.1 | Xem tổng quan – Dashboard TGĐ BSC | `/dashboard` | `GET /api/dashboard/overview` | `DASHBOARD:VIEW_UNIT` | — | ☐ |
| 17.2 | Lọc dữ liệu – Dashboard TGĐ BSC | `/dashboard` | `GET /api/dashboard/overview` | `DASHBOARD:VIEW_UNIT` | — | ☐ |
| 17.3 | Xem danh sách KPI theo thẻ chỉ số | `/dashboard (dialog)` | `GET /api/dashboard/kpi-list?card=` | `DASHBOARD:VIEW_UNIT` | — | ☐ |
| 17.4 | Xem danh sách chi tiết các KPI | `/dashboard (dialog)` | `GET /api/dashboard/kpi-list` | `DASHBOARD:VIEW_UNIT` | — | ☐ |
| 17.5 | Xem chi tiết KPI trọng tâm | `/dashboard (dialog)` | `GET /api/dashboard/focus-kpis/{kpiId}/breakdown` | `DASHBOARD:VIEW_UNIT` | — | ☐ |
| 17.6 | Xuất kết quả đánh giá KPI | `/dashboard` | `GET /api/dashboard/export-results` | `DASHBOARD:EXPORT` | — | ☐ |
| 17.7 | Xem bảng tổng hợp kết quả KPI giao cho Tổng công ty/Công ty | `/dashboard (dialog)` | `GET /api/dashboard/corporations/{unitId}/table` | `DASHBOARD:VIEW_GROUP` | — | ☐ |
| 17.8 | Xuất bảng tổng hợp kết quả KPI giao cho Tổng công ty/Công ty | `/dashboard (dialog)` | `GET /api/dashboard/corporations/{unitId}/table/export` | `DASHBOARD:EXPORT` | — | ☐ |
| 18.1 | KPI đơn vị của tôi – Xem theo kỳ đánh giá | `/my-kpi?view=period` | `GET /api/my-kpi/by-period` | `MYKPI:VIEW` | — | ☐ |
| 19.1 | KPI đơn vị của tôi – Xem theo chỉ tiêu KPI | `/my-kpi?view=kpi` | `GET /api/my-kpi/by-kpi` | `MYKPI:VIEW` | — | ☐ |
| 20.1 | KPI đơn vị của tôi – Theo dõi kết quả thẩm định và phản hồi | `/my-kpi?view=review` | `GET /api/my-kpi/review` | `MYKPI:VIEW` | — | ☐ |
| 21.1 | Đề nghị điều chỉnh kết quả KPI | `/my-kpi?view=review` | `POST /api/my-kpi/results/{id}/adjust-request` | `MYKPI:PROPOSE_ADJUST` | — | ☐ |
| 22.1 | Xuất kết quả đánh giá KPI theo mẫu | `/my-kpi?view=period` | `GET /api/my-kpi/export` | `MYKPI:EXPORT` | — | ☐ |
| 23.1 | Lấy danh sách – Danh sách KPI | `/kpi-admin/catalog?tab=kpi` | `GET /api/kpis/tree` | `KPI:VIEW` | — | ☐ |
| 23.2 | Tìm kiếm – Danh sách KPI | `/kpi-admin/catalog?tab=kpi` | `GET /api/kpis/tree?keyword&perspectiveId&objectiveId` | `KPI:VIEW` | — | ☐ |
| 23.3 | Xem chi tiết – Danh sách KPI | `/kpi-admin/catalog?tab=kpi` | `GET /api/kpis/{id}` | `KPI:VIEW` | — | ☐ |
| 23.4 | Ghi lại – Danh sách KPI | `/kpi-admin/catalog?tab=kpi` | `PUT /api/kpis/{id}` | `KPI:UPDATE` | — | ☐ |
| 23.5 | Xóa – Danh sách KPI | `/kpi-admin/catalog?tab=kpi` | `DELETE /api/kpis/{id}` | `KPI:DELETE` | — | ☐ |
| 23.6 | Nhập dữ liệu – Danh sách KPI | `/kpi-admin/catalog?tab=kpi` | `POST /api/kpis/import/validate, /commit` | `KPI:IMPORT` | — | ☐ |
| 23.7 | Xuất dữ liệu – Danh sách KPI | `/kpi-admin/catalog?tab=kpi` | `GET /api/kpis/export` | `KPI:EXPORT` | — | ☐ |
| 24.1 | Thêm mới tiêu chí đánh giá KPI – KPI đơn lẻ | `/kpi-admin/catalog?tab=kpi` | `POST /api/kpis, GET /api/kpis/next-code` | `KPI:CREATE` | — | ☐ |
| 25.1 | Thêm mới tiêu chí đánh giá KPI – KPI cha – con | `/kpi-admin/catalog?tab=kpi` | `POST /api/kpis (children[])` | `KPI:CREATE` | — | ☐ |
| 26.1 | Lấy danh sách – Đơn vị đo | `/kpi-admin/catalog?tab=uom` | `GET /api/uoms` | `UOM:VIEW` | — | ☐ |
| 26.2 | Tìm kiếm – Đơn vị đo | `/kpi-admin/catalog?tab=uom` | `GET /api/uoms?keyword&status` | `UOM:VIEW` | — | ☐ |
| 26.3 | Xem chi tiết – Đơn vị đo | `/kpi-admin/catalog?tab=uom` | `GET /api/uoms/{id}` | `UOM:VIEW` | — | ☐ |
| 26.4 | Thêm mới – Đơn vị đo | `/kpi-admin/catalog?tab=uom` | `POST /api/uoms` | `UOM:CREATE` | — | ☐ |
| 26.5 | Ghi lại – Đơn vị đo | `/kpi-admin/catalog?tab=uom` | `PUT /api/uoms/{id}` | `UOM:UPDATE` | — | ☐ |
| 26.6 | Xóa – Đơn vị đo | `/kpi-admin/catalog?tab=uom` | `DELETE /api/uoms/{id}` | `UOM:DELETE` | — | ☐ |
| 26.7 | Nhập dữ liệu – Đơn vị đo | `/kpi-admin/catalog?tab=uom` | `POST /api/uoms/import/validate, /commit` | `UOM:IMPORT` | — | ☐ |
| 26.8 | Xuất dữ liệu – Đơn vị đo | `/kpi-admin/catalog?tab=uom` | `GET /api/uoms/export` | `UOM:EXPORT` | — | ☐ |
| 26.9 | Lấy danh sách – Viễn cảnh | `/kpi-admin/catalog?tab=perspective` | `GET /api/perspectives` | `PERSPECTIVE:VIEW` | — | ☐ |
| 26.10 | Tìm kiếm – Viễn cảnh | `/kpi-admin/catalog?tab=perspective` | `GET /api/perspectives?keyword&status` | `PERSPECTIVE:VIEW` | — | ☐ |
| 26.11 | Xem chi tiết – Viễn cảnh | `/kpi-admin/catalog?tab=perspective` | `GET /api/perspectives/{id}` | `PERSPECTIVE:VIEW` | — | ☐ |
| 26.12 | Thêm mới – Viễn cảnh | `/kpi-admin/catalog?tab=perspective` | `POST /api/perspectives` | `PERSPECTIVE:CREATE` | — | ☐ |
| 26.13 | Ghi lại – Viễn cảnh | `/kpi-admin/catalog?tab=perspective` | `PUT /api/perspectives/{id}` | `PERSPECTIVE:UPDATE` | — | ☐ |
| 26.14 | Xóa – Viễn cảnh | `/kpi-admin/catalog?tab=perspective` | `DELETE /api/perspectives/{id}` | `PERSPECTIVE:DELETE` | — | ☐ |
| 26.15 | Nhập dữ liệu – Viễn cảnh | `/kpi-admin/catalog?tab=perspective` | `POST /api/perspectives/import/validate, /commit` | `PERSPECTIVE:IMPORT` | — | ☐ |
| 26.16 | Xuất dữ liệu – Viễn cảnh | `/kpi-admin/catalog?tab=perspective` | `GET /api/perspectives/export` | `PERSPECTIVE:EXPORT` | — | ☐ |
| 26.17 | Lấy danh sách – Lịch đồng bộ | `/system/schedules` | `GET /api/schedules` | `SCHEDULE:VIEW` | — | ☐ |
| 26.18 | Xem chi tiết – Lịch đồng bộ | `/system/schedules` | `GET /api/schedules/{id}` | `SCHEDULE:VIEW` | — | ☐ |
| 26.19 | Ghi lại – Lịch đồng bộ | `/system/schedules` | `PUT /api/schedules/{id}, POST /api/schedules/{id}/run` | `SCHEDULE:UPDATE, SCHEDULE:RUN` | — | ☐ |
| 26.20 | Lấy danh sách – Tham số hệ thống | `/system/sys-configs` | `GET /api/sys-configs` | `SYSCONFIG:VIEW` | — | ☐ |
| 26.21 | Xem chi tiết – Tham số hệ thống | `/system/sys-configs` | `GET /api/sys-configs/{id}` | `SYSCONFIG:VIEW` | — | ☐ |
| 26.22 | Thêm mới – Tham số hệ thống | `/system/sys-configs` | `POST /api/sys-configs` | `SYSCONFIG:CREATE` | — | ☐ |
| 26.23 | Ghi lại – Tham số hệ thống | `/system/sys-configs` | `PUT /api/sys-configs/{id}` | `SYSCONFIG:UPDATE` | — | ☐ |
| 26.24 | Xóa – Tham số hệ thống | `/system/sys-configs` | `DELETE /api/sys-configs/{id}` | `SYSCONFIG:DELETE` | — | ☐ |
| 27.1 | Lấy danh sách – Định nghĩa KPI công thức | `/kpi-admin/catalog?tab=formula` | `GET /api/formula-definitions` | `FORMULA:VIEW` | — | ☐ |
| 27.2 | Tìm kiếm – Định nghĩa KPI công thức | `/kpi-admin/catalog?tab=formula` | `GET /api/formula-definitions?keyword&status` | `FORMULA:VIEW` | — | ☐ |
| 27.3 | Xem chi tiết – Định nghĩa KPI công thức | `/kpi-admin/catalog?tab=formula` | `GET /api/formula-definitions/{id}` | `FORMULA:VIEW` | — | ☐ |
| 27.4 | Thêm mới – Định nghĩa KPI công thức | `/kpi-admin/catalog?tab=formula` | `POST /api/formula-definitions, POST /{id}/test, POST /validate-expression` | `FORMULA:CREATE, FORMULA:TEST` | — | ☐ |
| 27.5 | Ghi lại – Định nghĩa KPI công thức | `/kpi-admin/catalog?tab=formula` | `PUT /api/formula-definitions/{id}` | `FORMULA:UPDATE` | — | ☐ |
| 27.6 | Xóa – Định nghĩa KPI công thức | `/kpi-admin/catalog?tab=formula` | `DELETE /api/formula-definitions/{id}` | `FORMULA:DELETE` | — | ☐ |
| 28.1 | Lấy danh sách – Mục tiêu trọng tâm | `/kpi-admin/objectives` | `GET /api/objectives` | `OBJECTIVE:VIEW` | — | ☐ |
| 28.2 | Tìm kiếm – Mục tiêu trọng tâm | `/kpi-admin/objectives` | `GET /api/objectives?keyword&perspectiveId` | `OBJECTIVE:VIEW` | — | ☐ |
| 28.3 | Xem chi tiết – Mục tiêu trọng tâm | `/kpi-admin/objectives` | `GET /api/objectives/{id}` | `OBJECTIVE:VIEW` | — | ☐ |
| 28.4 | Thêm mới – Mục tiêu trọng tâm | `/kpi-admin/objectives` | `POST /api/objectives` | `OBJECTIVE:CREATE` | — | ☐ |
| 28.5 | Ghi lại – Mục tiêu trọng tâm | `/kpi-admin/objectives` | `PUT /api/objectives/{id}` | `OBJECTIVE:UPDATE` | — | ☐ |
| 28.6 | Xóa – Mục tiêu trọng tâm | `/kpi-admin/objectives` | `DELETE /api/objectives/{id}` | `OBJECTIVE:DELETE` | — | ☐ |
| 28.7 | Nhập dữ liệu – Mục tiêu trọng tâm | `/kpi-admin/objectives` | `POST /api/objectives/import/validate, /commit` | `OBJECTIVE:IMPORT` | — | ☐ |
| 28.8 | Xuất dữ liệu – Mục tiêu trọng tâm | `/kpi-admin/objectives` | `GET /api/objectives/export` | `OBJECTIVE:EXPORT` | — | ☐ |
| 29.1 | Lấy danh sách – Giao KPI theo đơn vị | `/kpi-admin/assignments?tab=unit` | `GET /api/assignments/by-unit` | `ASSIGN:VIEW` | — | ☐ |
| 29.2 | Tìm kiếm – Giao KPI theo đơn vị | `/kpi-admin/assignments?tab=unit` | `GET /api/assignments/by-unit?keyword&year&status` | `ASSIGN:VIEW` | — | ☐ |
| 29.3 | Xem chi tiết – Giao KPI theo đơn vị | `/kpi-admin/assignments?tab=unit` | `GET /api/assignments/by-unit/{id}` | `ASSIGN:VIEW` | — | ☐ |
| 29.4 | Xóa – Giao KPI theo đơn vị | `/kpi-admin/assignments?tab=unit` | `DELETE /api/assignments/by-unit/{id}` | `ASSIGN:DELETE` | — | ☐ |
| 29.5 | Sao chép giao KPI theo đơn vị | `/kpi-admin/assignments?tab=unit` | `POST /api/assignments/by-unit/{id}/copy` | `ASSIGN:COPY` | — | ☐ |
| 30.1 | Thêm mới – Giao KPI theo đơn vị | `/kpi-admin/assignments/unit/new` | `POST /api/assignments/by-unit` | `ASSIGN:CREATE` | — | ☐ |
| 30.2 | Ghi lại – Giao KPI theo đơn vị | `/kpi-admin/assignments/unit/$id` | `PUT /api/assignments/by-unit/{id}` | `ASSIGN:UPDATE` | — | ☐ |
| 31.1 | Chốt số liệu giao KPI – Giao KPI theo đơn vị | `/kpi-admin/assignments?tab=unit` | `POST /api/assignments/by-unit/close` | `ASSIGN:CLOSE` | — | ☐ |
| 31.2 | Chốt số liệu giao KPI – Giao KPI theo chỉ tiêu | `/kpi-admin/assignments?tab=kpi` | `POST /api/assignments/by-kpi/close` | `ASSIGN:CLOSE` | — | ☐ |
| 32.1 | Lấy danh sách – Giao KPI theo chỉ tiêu | `/kpi-admin/assignments?tab=kpi` | `GET /api/assignments/by-kpi` | `ASSIGN:VIEW` | — | ☐ |
| 32.2 | Tìm kiếm – Giao KPI theo chỉ tiêu | `/kpi-admin/assignments?tab=kpi` | `GET /api/assignments/by-kpi?keyword&year&perspectiveId&status` | `ASSIGN:VIEW` | — | ☐ |
| 32.3 | Xem chi tiết – Giao KPI theo chỉ tiêu | `/kpi-admin/assignments?tab=kpi` | `GET /api/assignments/by-kpi/{kpiId}/{year}` | `ASSIGN:VIEW` | — | ☐ |
| 32.4 | Sao chép giao KPI theo chỉ tiêu | `/kpi-admin/assignments?tab=kpi` | `POST /api/assignments/by-kpi/copy` | `ASSIGN:COPY` | — | ☐ |
| 33.1 | Thêm mới – Giao KPI theo chỉ tiêu | `/kpi-admin/assignments/kpi/new` | `POST /api/assignments/by-kpi` | `ASSIGN:CREATE` | — | ☐ |
| 33.2 | Ghi lại – Giao KPI theo chỉ tiêu | `/kpi-admin/assignments/kpi/$kpiId/$year` | `PUT /api/assignments/by-kpi/{kpiId}/{year}` | `ASSIGN:UPDATE` | — | ☐ |
| 34.1 | Điều chỉnh – Lưu nháp | `/kpi-admin/assignments/kpi/$kpiId/$year/adjust` | `POST /api/assignments/by-kpi/{kpiId}/{year}/adjustment/draft` | `ASSIGN:ADJUST` | — | ☐ |
| 34.2 | Điều chỉnh – Lưu chốt | `/kpi-admin/assignments/kpi/$kpiId/$year/adjust` | `POST /api/assignments/by-kpi/{kpiId}/{year}/adjustment/commit` | `ASSIGN:ADJUST` | — | ☐ |
| 34.3 | Điều chỉnh – Xem lịch sử điều chỉnh | `/kpi-admin/assignments/kpi/$kpiId/$year/adjust` | `GET /api/assignments/details/{detailId}/history` | `ASSIGN:VIEW` | — | ☐ |
| 35.1 | Giao KPI – Nhập dữ liệu | `/kpi-admin/assignments/unit/new, /kpi/new` | `POST /api/assignments/import/parse` | `ASSIGN:IMPORT` | — | ☐ |
| 35.2 | Xuất dữ liệu – Giao KPI theo đơn vị | `/kpi-admin/assignments?tab=unit` | `GET /api/assignments/by-unit/export` | `ASSIGN:EXPORT` | — | ☐ |
| 36.1 | Lấy danh sách – Bản đồ chiến lược | `/kpi-admin/strategies` | `GET /api/strategies` | `STRATEGY:VIEW` | — | ☐ |
| 36.2 | Tìm kiếm – Bản đồ chiến lược | `/kpi-admin/strategies` | `GET /api/strategies?keyword&ownerId&fromYear&toYear&status&orgUnitId` | `STRATEGY:VIEW` | — | ☐ |
| 36.3 | Xem chi tiết – Bản đồ chiến lược | `/kpi-admin/strategies/$id?mode=view` | `GET /api/strategies/{id}, GET /api/strategies/{id}/map` | `STRATEGY:VIEW` | — | ☐ |
| 36.4 | Thêm mới – Bản đồ chiến lược | `/kpi-admin/strategies` | `POST /api/strategies` | `STRATEGY:CREATE` | — | ☐ |
| 36.5 | Ghi lại – Bản đồ chiến lược | `/kpi-admin/strategies/$id` | `PUT /api/strategies/{id}` | `STRATEGY:UPDATE` | — | ☐ |
| 36.6 | Xóa – Bản đồ chiến lược | `/kpi-admin/strategies` | `DELETE /api/strategies/{id}` | `STRATEGY:DELETE` | — | ☐ |
| 37.1 | Cập nhật mục tiêu trọng tâm trên bản đồ chiến lược | `/kpi-admin/strategies/$id` | `GET /api/objectives/search-for-strategy, PUT /api/strategies/{id}/map` | `STRATEGY:UPDATE` | — | ☐ |
| 37.2 | Vẽ liên kết giữa các mục tiêu trọng tâm | `/kpi-admin/strategies/$id` | `PUT /api/strategies/{id}/map` | `STRATEGY:UPDATE` | — | ☐ |
| 37.3 | Xóa mục tiêu trọng tâm khỏi bản đồ | `/kpi-admin/strategies/$id` | `PUT /api/strategies/{id}/map` | `STRATEGY:UPDATE` | — | ☐ |
| 37.4 | Xem KPI của mục tiêu trọng tâm trên bản đồ | `/kpi-admin/strategies/$id` | `GET /api/strategies/{id}/objectives/{objId}/kpis` | `STRATEGY:VIEW` | — | ☐ |
| 37.5 | Tải ảnh bản đồ chiến lược | `/kpi-admin/strategies/$id` | `(client html-to-image)` | `STRATEGY:EXPORT_IMAGE` | — | ☐ |
| 37.6 | Xóa liên kết giữa các mục tiêu trọng tâm | `/kpi-admin/strategies/$id` | `PUT /api/strategies/{id}/map` | `STRATEGY:UPDATE` | — | ☐ |
| 38.1 | Gán khung KPI vào chiến lược | `/kpi-admin/strategies/$id` | `PUT /api/strategies/{id}/map` | `STRATEGY:ASSIGN_KPI` | — | ☐ |
| 39.1 | Lấy danh sách – Tổng hợp BSC theo chỉ tiêu KPI | `/kpi-admin/evaluations?tab=kpi` | `GET /api/evaluations/by-kpi` | `EVAL:VIEW` | — | ☐ |
| 39.2 | Tìm kiếm – Tổng hợp BSC theo chỉ tiêu KPI | `/kpi-admin/evaluations?tab=kpi` | `GET /api/evaluations/by-kpi?keyword&year&period&perspectiveId&status&resultType` | `EVAL:VIEW` | — | ☐ |
| 39.3 | Xem chi tiết – Tổng hợp BSC theo chỉ tiêu KPI | `/kpi-admin/evaluations/$evalKpiId?mode=view` | `GET /api/evaluations/by-kpi/{evalKpiId}, /results` | `EVAL:VIEW` | — | ☐ |
| 40.1 | Lấy danh sách – Theo dõi kết quả thẩm định và phản hồi | `/kpi-admin/evaluations?tab=review` | `GET /api/evaluations/review` | `EVAL:VIEW` | — | ☐ |
| 40.2 | Tìm kiếm – Theo dõi kết quả thẩm định và phản hồi | `/kpi-admin/evaluations?tab=review` | `GET /api/evaluations/review?keyword&year&period&status` | `EVAL:VIEW` | — | ☐ |
| 40.3 | Xem chi tiết – Theo dõi kết quả thẩm định và phản hồi | `/kpi-admin/evaluations?tab=review` | `GET /api/evaluations/results/{id}` | `EVAL:VIEW` | — | ☐ |
| 41.1 | Điều chỉnh kết quả KPI cho đơn vị | `/kpi-admin/evaluations?tab=review` | `PUT /api/evaluations/results/{id}/adjust` | `EVAL:ADJUST` | — | ☐ |
| 42.1 | Cập nhật kết quả đánh giá KPI (SL nhập tay) cho đơn vị | `/kpi-admin/evaluations?tab=review` | `PUT /api/evaluations/results/{id}/manual` | `EVAL:INPUT` | — | ☐ |
| 43.1 | Đánh giá – Đồng bộ lại | `/kpi-admin/evaluations/$evalKpiId` | `POST /api/evaluations/{evalKpiId}/sync` | `EVAL:SYNC` | — | ☐ |
| 44.1 | Đánh giá – Tổng hợp BSC theo chỉ tiêu KPI (nhập tay) | `/kpi-admin/evaluations/$evalKpiId` | `PUT /api/evaluations/{evalKpiId}/results, POST /calculate-preview` | `EVAL:INPUT` | — | ☐ |
| 44.2 | Đánh giá – Nhập dữ liệu | `/kpi-admin/evaluations/$evalKpiId` | `GET /api/evaluations/{evalKpiId}/manual-template, POST /manual-import` | `EVAL:IMPORT` | — | ☐ |
| 45.1 | Xem chi tiết – Xuất biểu giao KPI | `/kpi-admin/bsc?tab=summary` | `GET /api/reports/assignment-sheet` | `BSC:REPORT` | — | ☐ |
| 45.2 | Xem chi tiết – Xuất biểu kết quả KPI | `/kpi-admin/bsc?tab=summary` | `GET /api/reports/result-sheet` | `BSC:REPORT` | — | ☐ |
| 46.1 | Lấy danh sách – Tổng hợp kết quả BSC | `/kpi-admin/bsc?tab=summary` | `GET /api/bsc/summary` | `BSC:VIEW` | — | ☐ |
| 46.2 | Tìm kiếm – Tổng hợp kết quả BSC | `/kpi-admin/bsc?tab=summary` | `GET /api/bsc/summary?keyword&year&period&perspectiveId&status&dataType` | `BSC:VIEW` | — | ☐ |
| 46.3 | Xem chi tiết – Tổng hợp kết quả BSC | `/kpi-admin/bsc?tab=summary` | `GET /api/bsc/summary/by-unit, /by-kpi` | `BSC:VIEW` | — | ☐ |
| 46.4 | Thu hồi kết quả đánh giá | `/kpi-admin/bsc?tab=summary` | `POST /api/bsc/revoke` | `BSC:REVOKE` | — | ☐ |
| 46.5 | Tính lại điểm đánh giá | `/kpi-admin/bsc?tab=summary` | `POST /api/bsc/recalculate` | `BSC:RECALC` | — | ☐ |
| 47.1 | Lấy danh sách – Theo dõi kết quả thẩm định và phản hồi (Tổng hợp BSC) | `/kpi-admin/bsc?tab=review` | `GET /api/bsc/review` | `BSC:VIEW` | — | ☐ |
| 47.2 | Tìm kiếm – Theo dõi kết quả thẩm định và phản hồi (Tổng hợp BSC) | `/kpi-admin/bsc?tab=review` | `GET /api/bsc/review?keyword&year&period&status` | `BSC:VIEW` | — | ☐ |
| 47.3 | Xem chi tiết – Theo dõi kết quả thẩm định và phản hồi (Tổng hợp BSC) | `/kpi-admin/bsc?tab=review` | `GET /api/evaluations/results/{id}` | `BSC:VIEW` | — | ☐ |
| 47.4 | Thu hồi kết quả đánh giá theo đơn vị | `/kpi-admin/bsc?tab=review` | `POST /api/bsc/revoke-unit` | `BSC:REVOKE` | — | ☐ |
| 48.1 | Chốt đánh giá KPI – Đủ điều kiện | `/kpi-admin/bsc?tab=summary` | `POST /api/bsc/close` | `BSC:CLOSE` | — | ☐ |
| 48.2 | Chốt đánh giá KPI – Cảnh báo không đủ điều kiện | `/kpi-admin/bsc?tab=summary` | `POST /api/bsc/close → 409` | `BSC:CLOSE` | — | ☐ |
| 48.3 | Chốt đánh giá KPI – Đủ điều kiện (tab Theo dõi) | `/kpi-admin/bsc?tab=review` | `POST /api/bsc/close` | `BSC:CLOSE` | — | ☐ |
| 48.4 | Chốt đánh giá KPI – Cảnh báo không đủ điều kiện (tab Theo dõi) | `/kpi-admin/bsc?tab=review` | `POST /api/bsc/close → 409` | `BSC:CLOSE` | — | ☐ |
| 49.1 | Chốt kết quả R2 – Tổng hợp BSC theo chỉ tiêu KPI | `/kpi-admin/evaluations?tab=kpi` | `POST /api/evaluations/{evalKpiId}/close-r2` | `EVAL:CLOSE_R2` | — | ☐ |
| 50.1 | Tổng giám đốc duyệt – Cảnh báo không đủ điều kiện | `/kpi-admin/bsc?tab=summary` | `POST /api/bsc/approve/check` | `BSC:APPROVE` | — | ☐ |
| 50.2 | Tổng giám đốc duyệt – Ký duyệt | `/kpi-admin/bsc?tab=summary` | `POST /api/bsc/approve` | `BSC:APPROVE` | — | ☐ |
| 50.3 | Tổng giám đốc duyệt – Cảnh báo không đủ điều kiện (tab Theo dõi) | `/kpi-admin/bsc?tab=review` | `POST /api/bsc/approve/check` | `BSC:APPROVE` | — | ☐ |
| 50.4 | Tổng giám đốc duyệt – Ký duyệt (tab Theo dõi) | `/kpi-admin/bsc?tab=review` | `POST /api/bsc/approve` | `BSC:APPROVE` | — | ☐ |
| 51.1 | Xuất báo cáo TTr94 tổng hợp BSC | `/kpi-admin/bsc?tab=summary` | `POST /api/reports/TTR94_TONG_HOP` | `BSC:REPORT` | — | ☐ |
| 51.2 | Xuất báo cáo TTr94 tổng hợp BSC (tab Theo dõi) | `/kpi-admin/bsc?tab=review` | `POST /api/reports/TTR94_TONG_HOP` | `BSC:REPORT` | — | ☐ |
| 52.1 | Xuất báo cáo TTr94 chi tiết KPI | `/kpi-admin/bsc?tab=summary` | `POST /api/reports/TTR94_CHI_TIET` | `BSC:REPORT` | — | ☐ |
| 52.2 | Xuất báo cáo TTr94 chi tiết KPI (tab Theo dõi) | `/kpi-admin/bsc?tab=review` | `POST /api/reports/TTR94_CHI_TIET` | `BSC:REPORT` | — | ☐ |
| 53.1 | Xuất báo cáo KPI từng tỉnh | `/kpi-admin/bsc?tab=summary` | `POST /api/reports/KPI_TUNG_TINH` | `BSC:REPORT` | — | ☐ |
| 53.2 | Xuất báo cáo KPI từng tỉnh (tab Theo dõi) | `/kpi-admin/bsc?tab=review` | `POST /api/reports/KPI_TUNG_TINH` | `BSC:REPORT` | — | ☐ |
| 54.1 | Thông báo (notify) trên hệ thống | `(Header – chuông), /notifications` | `GET /api/notifications, /unread-count, POST /{id}/read, /read-all` | `NOTIFY:VIEW` | — | ☐ |

## 2. Kiến trúc (Phần 2 E-HSMT — 7 mục, PHẦN B)

| Mục | Nội dung | Bằng chứng | Trạng thái |
|---|---|---|---|
| A1 | Tổng quan giải pháp (§1) | `docs/KIEN-TRUC.md` §1; vai trò seed `R__seed_01_identity.sql` | ☐ |
| A2 (b) | Kiến trúc tổng thể (§2) | `docs/KIEN-TRUC.md` §2; `deploy/nginx/kpi.conf`; `backend/.../config/*` | ☐ |
| A3 (c) | Kiến trúc chức năng F01–F07 (§3.1) | `backend/src/main/java/vn/vnpt/kpi/modules/*` | ☐ |
| A4 (d) | Kiến trúc ứng dụng FE/BE (§3.2–3.3) | `frontend/src/api/http.ts`, `routes/index.tsx`, `authGuards.ts`, `stores/*`; BE `SecurityConfig`, `JwtAuthenticationFilter`, `VnptSsoController` | ☐ |
| A5 (e) | Kiến trúc dữ liệu (§4) | `backend/src/main/resources/db/migration/V001__init.sql` … | ☐ |
| A6 (f) | Kiến trúc tích hợp (§8) | `integration/cas`, `integration/kpisource`, `integration/hrm`, `integration/mail`, `integration/zalo` | ☐ |
| A7 (g,h) | Bảo mật (§9) & hạ tầng (§10) | `config/SecurityConfig`, `StartupSecurityCheck`, `docs/ATTT.md`, `docs/TRIEN-KHAI.md`, `deploy/*` | ☐ |

## 3. Phi chức năng (Phần 3 E-HSMT — 11 mục, PHẦN D §1)

| Mục | Nội dung | Bằng chứng | Trạng thái |
|---|---|---|---|
| NF-a | Hệ quản trị CSDL (mô hình, mã hóa, RBAC, giám sát, injection, sao lưu, phiên, hiệu suất, tuân thủ) | migrations; `EncryptedStringTypeHandler`; `audit_log`; màn hình “Nhật ký hệ thống”; `deploy/scripts/backup-db.sh`; `docs/VAN-HANH.md` | ☐ |
| NF-b | Tích hợp hệ thống | `VnptSsoController`, `HrmClient`, `KpiSourceClient` | ☐ |
| NF-c | Hiệu năng (500 user, 100 TPS) | `perf/k6-mix.js`, `docs/perf-report.md` | ☐ |
| NF-d | An toàn thông tin | SpotBugs/FindSecBugs, Dependency-Check, `npm audit`, Semgrep, ZAP; `docs/ATTT.md` | ☐ |
| NF-e | Tùy chỉnh chức năng & cấu hình | Vai trò theo đơn vị, `sys_config`, `sync_schedule`, `scoring_method`, `report_template` | ☐ |
| NF-f | Hạ tầng | `docs/TRIEN-KHAI.md`, `deploy/systemd`, `deploy/nginx`, hardening | ☐ |
| NF-g | Giao diện & trải nghiệm | Tailwind tokens, font Be Vietnam Pro, 1024×768 e2e, toast/validate | ☐ |
| NF-h | Ổn định | 2 node, graceful shutdown, readiness/liveness | ☐ |
| NF-i | Khả dụng | Tìm kiếm đa tiêu chí mọi danh sách | ☐ |
| NF-j | Đào tạo | `docs/HDSD/*.md`, `docs/HDQT.md` | ☐ |
| NF-k | Bảo hành | `/api/actuator/info`, log JSON `traceId`, `docs/VAN-HANH.md` | ☐ |

