# MASTER IMPLEMENTATION PLAN — CEV Equipment Management

## Kiến trúc bắt buộc hiện tại

```text
User
  ↓
Vercel Frontend
React + Vite + TypeScript
  ↓
Supabase
├─ PostgreSQL
├─ Auth / app role
├─ RLS
├─ private Storage
└─ RPC / transactional workflow
```

Apps Script / Google Sheets / Google Drive không còn thuộc runtime mới trên nhánh này.

Canonical frontend origin:

`https://iatf-16949-equipment-management.vercel.app`

## Nguyên tắc dữ liệu cốt lõi

**Một thiết bị = một mã thiết bị = một hồ sơ gốc = toàn bộ nghiệp vụ cùng tham chiếu mã đó.**

- `equipment_master` là master thiết bị duy nhất.
- `PRODUCTION` và `MEASUREMENT` dùng chung Equipment Master.
- `calibration_master` là hồ sơ nghiệp vụ hiệu chuẩn của thiết bị MEASUREMENT.
- Tooling có lifecycle riêng theo `tooling_id`.
- Không tạo master song song theo phòng ban.
- Đổi `equipment_id` phải propagate FK an toàn và xử lý Storage path tương ứng.

---

# Phase 1 — G1 contract / domain foundation — COMPLETE

- G1 contract frozen: `G1-frozen-2026-08-28`.
- 20 business tables.
- Domain schemas, workflow guards, KPI engine.
- Source-first / canonical equipment identity được giữ nguyên.

# Phase 2 — Supabase persistence cutover — COMPLETE

- PostgreSQL schema + FK/index.
- Auth + `app_user_role`.
- RLS.
- 9 private evidence buckets.
- Equipment data migration.
- Apps Script/Google runtime code đã purge khỏi branch.

# Phase 3 — Transactional workflow RPC — COMPLETE

Đã chuyển các mutation quan trọng xuống database authority:

- Daily Inspection.
- `STOP_REPAIR` → Inspection + Work Order + Downtime + Equipment DOWN trong một transaction.
- Maintenance Work Order create/transition.
- BM-05 accepted gate trước `RELEASE`.
- Tooling Master / Plan / Modification workflow.
- Calibration Log + Calibration Master update + Audit.
- Equipment Master update + Audit.

Role/RLS smoke test và transaction rollback test đã thực hiện.

# Phase 4 — Enterprise frontend — COMPLETE FOR CORE WORKSPACES

Các workspace chính:

1. Dashboard Control Center + Action Queue.
2. Equipment Master + profile 360° + ảnh.
3. Daily Inspection.
4. Maintenance / Work Order.
5. Jig & Tooling.
6. Calibration + log/chứng chỉ.
7. Audit & Cấu hình.

UI pattern chuẩn:

```text
KPI → search/filter → data table → detail/profile drawer → explicit action
```

Drawer/profile hỗ trợ `Esc` và click backdrop để đóng nhanh.

## Permission UX

Frontend mirror role-check backend từ một permission matrix trung tâm:

- `MAINTENANCE`
- `SUPERVISOR`
- `QUALITY`
- `MANAGER`
- `ADMIN`

RLS/RPC vẫn là authority thực sự; ẩn button ở UI không thay thế security backend.

# Phase 5 — Performance / cleanup — CURRENT

## 5.1 Code splitting

- Workspace được `React.lazy` theo màn.
- `main.tsx` không được static-import workspace vì sẽ vô hiệu dynamic import.
- Supabase diagnostics được lazy-load riêng.

## 5.2 Cleanup

- Xóa runtime Apps Script/Google cũ.
- Giữ `source/**` vì đây là hồ sơ/quy trình nghiệp vụ IATF.
- Dọn CSS component cũ chỉ khi xác nhận không còn class reference.
- README/docs phải mô tả Supabase-only là kiến trúc hiện hành của branch.

## 5.3 Quality gate

Mọi thay đổi core phải đạt:

```text
npm test
npm run build
npm run lint
```

GitHub Quality Gate phải PASS trước production cutover.

---

# Phase 6 — Production cutover gate — NEXT

Không merge/cutover chỉ vì UI chạy được. Cần đủ các gate sau:

1. GitHub Quality Gate PASS trên HEAD cuối.
2. Vercel build/deploy preview thành công khi quota cho phép.
3. Supabase env production được cấu hình đúng trên Vercel.
4. Auth/session + app role được xác nhận trong browser.
5. RLS negative tests cho non-ADMIN/non-authorized roles PASS.
6. Equipment read/edit/photo upload PASS.
7. Inspection `V` và `STOP_REPAIR` PASS.
8. Maintenance full workflow + BM-05 gate PASS.
9. Calibration Log + certificate upload/read PASS.
10. Tooling workflow PASS.
11. Audit ADMIN-only PASS.
12. Reconcile record counts và canonical equipment IDs.
13. Backup/rollback plan được chốt trước khi đổi `main`.

# Phase 7 — Post-cutover hardening

Sau production cutover:

- observability/error telemetry;
- backup/recovery drill;
- operator/admin guide;
- performance monitoring;
- evidence retention policy;
- G2/BM-10B extensions;
- advanced maintenance analytics.
