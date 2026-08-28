# Phase 3 — Google persistence

## Trạng thái

- G1 contract: `G1-frozen-2026-08-28`
- Canonical Google Sheet: `1zvrMyGDnXy3HMRzFrLYS4IFyuYPsSUTROy22M6Le9VE`
- Project Drive folder: `1hxow8p4gir4KRJZUMhEntsrazjAqfVGI`
- Locale: `vi_VN`
- Time zone: `Asia/Ho_Chi_Minh` (Google có thể hiển thị alias `Asia/Saigon`)
- Frontend direct Google Sheets/Drive API: **không cho phép**
- Persistence boundary: **Google Apps Script Web App**
- Production browser transport: **Apps Script HTMLService first-party UI + `google.script.run`**
- Vercel/serverless persistence backend: **không sử dụng**
- Service account JSON: **không sử dụng**

## Dữ liệu đã seed từ source

### Calibration

- `Calibration_Master`: 48 dòng từ snapshot `2024.06.01 HIỆU CHUẨN (2)/(3)`.
- Không tự suy diễn ngày hiệu chuẩn: dòng không có ngày trong source giữ trống.
- `Calibration_Vendor_Quote`: 230 dòng chi tiết, tương ứng 46 dòng báo giá × 5 nhà cung cấp.
- `Calibration_Quote_Summary`: 5 nhà cung cấp, tổng tiền khớp source.
- Báo giá được đánh dấu là dữ liệu lịch sử, không phải giá live.
- ISOCAL giữ VAT 5% vì số tiền VAT `1.115.000` trên subtotal `22.300.000` và total `23.415.000` tương ứng chính xác 5%, dù nhãn hàng tổng trong source dùng chữ `VAT 8%`.

### Equipment

- `Equipment_Master`: 19 thiết bị từ BM-TBSX-02, phần được source ghi rõ là “Danh mục chính thức của nhà máy”.
- 16 máy Die Casting: giữ trống năm sản xuất/ngày/vị trí/trạng thái vì source để trống.
- CNC-001, LATHE-002, WELD-003: map model, serial, năm, ngày đưa vào sử dụng, vị trí, bộ phận và trạng thái theo source.
- Chu kỳ bảo dưỡng 3 tháng được giữ ở `maintenanceCycleMonths = 3`.
- Không tự gán criticality, supplier, tài liệu, QR hoặc giá trị vào schema G1 vì source không cung cấp các trường tương ứng một cách đầy đủ.

### Tooling / Maintenance / Inspection

- BM-TBSX-09 hiện chỉ là biểu mẫu trống, vì vậy chưa seed `Tooling_Master`.
- BM-TBSX-03 và BM-TBSX-04 có ví dụ từ file gốc nhưng không được coi là transaction production live; chưa seed các bảng Maintenance transaction.
- BM-KTTBHN cung cấp checklist và quy tắc V/○/△/X nhưng không chứa nhật ký kiểm tra hàng ngày thực tế; chưa seed `Daily_Inspection`/`Daily_Inspection_Item`.

## Kiến trúc Apps Script

`apps-script/Code.gs`, `apps-script/Maintenance.gs` và HTMLService UI tạo persistence/workflow boundary duy nhất giữa người dùng và Google Sheets/Drive.

Luồng production chuẩn:

1. Người dùng mở UI được host trực tiếp bởi Apps Script HTMLService (`?action=app`).
2. UI gọi Apps Script server-side bằng `google.script.run`; không dùng browser cross-origin `fetch()` tới `/exec`.
3. Apps Script lấy người dùng thực tế từ `Session.getActiveUser().getEmail()`.
4. Role được tra từ Script Property `RBAC_JSON`; browser không được tin cậy để tự khai actor hoặc role.
5. Apps Script kiểm tra `contractVersion`, table allowlist và role policy.
6. Write/transition chạy trong `LockService`.
7. `operationId` được dùng làm idempotency key và lưu bền trong append-only `Audit_Log`, không dùng Script Properties làm operation store.
8. Apps Script tự append `Audit_Log`; client không được ghi trực tiếp `Audit_Log`.
9. Maintenance state machine được kiểm tra lại phía Apps Script trước khi thay đổi Work Order.
10. `APPROVE` chặn requester tự phê duyệt.
11. `VERIFY` lấy `performedBy` authoritative từ `Maintenance_Execution` và chặn performer tự verify.
12. `RELEASE` yêu cầu BM-05 đã accepted và condition không phải `NOT_OPERABLE`.

Browser `fetch()` trực tiếp từ Vercel/Netlify tới Apps Script đã được kiểm thử và thất bại do cross-origin redirect/CORS. Iframe bridge cũng không được dùng làm production transport vì embedded Google auth không ổn định. Hai đường này chỉ giữ lại cho lịch sử/diagnostic trong source; production dùng first-party HTMLService.

Không dùng OAuth token, refresh token, service-account JSON hoặc private key trong repo hay browser bundle.

## Live verification đã đạt ngày 2026-08-28

- Apps Script deployment chạy **as user accessing the web app**.
- Direct health trả `authenticated=true`.
- `RBAC_JSON` nhận diện user thật và trả actor từ server-side session.
- Apps Script HTMLService `AppShell` tải thành công ở first-party context.
- `google.script.run → bridgeInvoke → readTable(Equipment_Master)` trả `ok=true`.
- Actor được trả từ server và `Equipment_Master` trả đúng 19 dòng source-seeded.
- Contract khớp `G1-frozen-2026-08-28`.

## Gate đã hoàn tất

- [x] G1 schema/workflow/persistence contract freeze.
- [x] Canonical Google Sheet + 9 Drive evidence folders.
- [x] Source seeding Calibration và Equipment.
- [x] React workflow transition tách thành pure domain execution.
- [x] Mobile navigation truy cập đủ 7 workspace.
- [x] Workflow action map sang governance policy và role-gate phía domain.
- [x] Requester self-approval bị chặn phía domain và Apps Script.
- [x] Apps Script-only persistence gateway.
- [x] Table allowlist + server-side role gate.
- [x] `LockService` critical section cho append và maintenance transition.
- [x] Durable idempotency lookup qua append-only `Audit_Log`.
- [x] Browser không gửi actor/role trong maintenance transition payload.
- [x] Maintenance state machine được enforce lại phía Apps Script.
- [x] `performedBy != verifierId` được enforce phía Apps Script từ `Maintenance_Execution`.
- [x] Vercel persistence endpoint/service-account architecture đã bị loại bỏ.
- [x] Apps Script Web App deploy thật và identity server-side hoạt động.
- [x] `RBAC_JSON` live hoạt động.
- [x] First-party HTMLService transport hoạt động.
- [x] End-to-end read smoke test với canonical `Equipment_Master` đạt 19 dòng.
- [x] AppShell Equipment Master live read-only workspace được triển khai trong source.

## Gate còn lại trước live write

- [ ] End-to-end append/idempotency smoke test bằng fixture riêng, không dùng production rows.
- [ ] End-to-end maintenance transition smoke test, bao gồm self-approval/self-verification negative cases.
- [ ] Nối maintenance UI live với server transition response thay vì chỉ local transition.
- [ ] Persist BM-05 thật trước RELEASE; không dùng demo handover làm authoritative record.
- [ ] Evidence upload qua Drive adapter Apps Script.
- [ ] Generic record update ngoài maintenance cần optimistic version/concurrency contract trước khi mở write.
- [ ] Hoàn tất production HTMLService UI cho các workspace còn lại.

Không bật production live write cho đến khi các gate write ở trên hoàn tất và Quality Gate xanh.