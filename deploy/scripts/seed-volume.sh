#!/usr/bin/env bash
# Sinh dữ liệu khối lượng lớn để kiểm thử hiệu năng (PHẦN C §1.a “Hiệu suất dữ liệu”):
#   - USERS tài khoản (mặc định 15.000) gắn ngẫu nhiên vào các đơn vị, vai trò “Người dùng đơn vị”
#   - lịch sử đánh giá YEARS năm trước (mặc định 10) nhân bản từ năm có dữ liệu gần nhất (evaluation_kpi + evaluation_result)
#   - AUDIT bản ghi audit_log (mặc định 2.000.000)
# Chỉ chạy trên môi trường kiểm thử/staging, KHÔNG chạy trên production.
#   DB=kpi_bsc_perf MYSQL="mysql -uroot -p..." USERS=15000 YEARS=10 AUDIT=2000000 ./seed-volume.sh
# Dev (docker): MYSQL="docker compose -f deploy/docker-compose.dev.yml exec -T mariadb mariadb -uroot -proot_dev_only" DB=kpi_bsc ./seed-volume.sh
set -euo pipefail
DB=${DB:-kpi_bsc}
MYSQL=${MYSQL:-mysql -uroot}
USERS=${USERS:-15000}
YEARS=${YEARS:-10}
AUDIT=${AUDIT:-2000000}
run() { $MYSQL "$DB" -e "$1"; }
START=$(date +%s)

echo ">> $USERS tài khoản người dùng (perf_uNNNNN, mật khẩu như tài khoản dev)"
run "
SET @pw = (SELECT password_hash FROM app_user WHERE username = 'tinh_hni' LIMIT 1);
INSERT IGNORE INTO app_user (username, full_name, email, org_unit_id, status, auth_source, password_hash, created_by, updated_by)
SELECT CONCAT('perf_u', LPAD(s.seq, 5, '0')), CONCAT('Người dùng kiểm thử ', s.seq), CONCAT('perf_u', s.seq, '@vnpt.vn'),
       (SELECT id FROM org_unit WHERE deleted = 0 ORDER BY RAND(s.seq) LIMIT 1), 'HOAT_DONG', 'BOTH', @pw, 'seed-volume', 'seed-volume'
FROM seq_1_to_${USERS} s;
INSERT IGNORE INTO user_role (user_id, role_id, org_unit_id, assigned_by)
SELECT u.id, r.id, NULL, 'seed-volume' FROM app_user u JOIN role r ON r.code = 'NGUOI_DUNG_DV' WHERE u.username LIKE 'perf_u%';"

echo ">> Lịch sử đánh giá $YEARS năm"
BASE=$($MYSQL "$DB" -N -e "SELECT MIN(year) FROM evaluation_kpi WHERE deleted = 0")
for i in $(seq 1 "$YEARS"); do
  Y=$((BASE - i))
  run "
INSERT IGNORE INTO evaluation_kpi (kpi_id, year, period_code, status, result_type, created_by, updated_by)
SELECT kpi_id, $Y, period_code, status, result_type, 'seed-volume', 'seed-volume' FROM evaluation_kpi WHERE year = $BASE AND deleted = 0;
INSERT IGNORE INTO evaluation_result (evaluation_kpi_id, org_unit_id, plan_value, year_plan_value, kpi_result, final_result, completion_rate,
  year_completion_rate, score, bsc_score, rating, status, created_by, updated_by)
SELECT nk.id, r.org_unit_id, r.plan_value, r.year_plan_value, r.kpi_result * (0.85 + RAND() * 0.3), r.final_result * (0.85 + RAND() * 0.3),
       r.completion_rate, r.year_completion_rate, r.score, r.bsc_score, r.rating, 'TGD_DA_DUYET', 'seed-volume', 'seed-volume'
FROM evaluation_result r JOIN evaluation_kpi ok ON ok.id = r.evaluation_kpi_id
JOIN evaluation_kpi nk ON nk.kpi_id = ok.kpi_id AND nk.period_code = ok.period_code AND nk.year = $Y
WHERE ok.year = $BASE AND r.deleted = 0;
INSERT IGNORE INTO bsc_unit_summary (org_unit_id, year, period_code, total_kpi, achieved, not_achieved, tracking, warning, completion_rate, bsc_score, rank_in_group, rank_group)
SELECT org_unit_id, $Y, period_code, total_kpi, achieved, not_achieved, tracking, warning, completion_rate, bsc_score, rank_in_group, rank_group
FROM bsc_unit_summary WHERE year = $BASE;"
  echo "   năm $Y xong"
done

echo ">> $AUDIT bản ghi audit_log (theo lô 100.000)"
DONE=0
while [ "$DONE" -lt "$AUDIT" ]; do
  N=$(( AUDIT - DONE < 100000 ? AUDIT - DONE : 100000 ))
  run "
INSERT INTO audit_log (user_id, username, action, entity, entity_id, before_json, after_json, ip, user_agent, trace_id, at)
SELECT NULL, CONCAT('perf_u', LPAD(1 + (s.seq % ${USERS}), 5, '0')), ELT(1 + (s.seq % 4), 'THEM', 'SUA', 'XOA', 'DANG_NHAP'),
       'evaluation_result', s.seq, NULL, CONCAT('{\"seq\":', s.seq, '}'), '10.0.0.1', 'seed-volume', NULL,
       NOW(3) - INTERVAL (s.seq % 1000) DAY
FROM seq_1_to_${N} s;"
  DONE=$((DONE + N))
  echo "   $DONE/$AUDIT"
done

$MYSQL "$DB" -e "SELECT table_name, table_rows, ROUND((data_length + index_length) / 1024 / 1024) AS size_mb
FROM information_schema.tables WHERE table_schema = '$DB' AND table_name IN ('app_user','evaluation_kpi','evaluation_result','bsc_unit_summary','audit_log')"
echo ">> Hoàn tất sau $(( $(date +%s) - START ))s"
