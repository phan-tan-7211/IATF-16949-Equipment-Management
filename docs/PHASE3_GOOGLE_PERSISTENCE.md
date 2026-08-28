# Phase 3 — Google persistence

## Trạng thái

- G1 contract: `G1-frozen-2026-08-28`
- Canonical Google Sheet: `1zvrMyGDnXy3HMRzFrLYS4IFyuYPsSUTROy22M6Le9VE`
- Project Drive folder: `1hxow8p4gir4KRJZUMhEntsrazjAqfVGI`
- Locale: `vi_VN`
- Time zone: `Asia/Ho_Chi_Minh` (Google có thể hiển thị alias `Asia/Saigon`)
- Frontend direct Google Sheets/Drive API: **không cho phép**
- Persistence boundary: **Google Apps Script Web App**
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

`apps-script/Code.gs` là persistence gateway duy nhất giữa UI và Google Sheets/Drive.

Luồng chuẩn:

1. UI gọi Apps Script Web App.
2. Apps Script lấy người dùng thực tế từ `Session.getActiveUser().getEmail()`.
3. Role được tra từ Script Property `RBAC_JSON`; browser không được tin cậy để tự khai role.
4. Apps Script kiểm tra `contractVersion`, table allowlist và role policy.
5. Write chạy trong `LockService` để tránh ghi đồng thời làm sai transaction logic.
6. `operationId` được dùng làm idempotency key.
7. Record được append vào sheet đích theo header G1.
8. Apps Script tự append `Audit_Log`; client không được ghi trực tiếp `Audit_Log`.

Không dùng OAuth token, refresh token, service-account JSON hoặc private key trong repo hay browser bundle.

## Gate đã hoàn tất

- [x] G1 schema/workflow/persistence contract freeze.
- [x] Canonical Google Sheet + 9 Drive evidence folders.
- [x] Source seeding Calibration và Equipment.
- [x] React workflow transition tách thành pure domain execution; không còn side effect lồng trong `setWorkOrders` updater.
- [x] Mobile navigation truy cập đủ 7 workspace.
- [x] Workflow action map sang governance policy và role-gate trước transition.
- [x] Requester self-approval bị chặn.
- [x] Apps Script persistence gateway scaffold được tạo.
- [x] Apps Script có table allowlist, role gate, `LockService`, idempotency và append-only `Audit_Log` path.
- [x] Vercel persistence endpoint/service-account architecture đã bị loại bỏ.

## Gate còn lại trước live write

- [ ] Tạo/deploy Apps Script Web App từ thư mục `apps-script/`.
- [ ] Cấu hình Script Property `RBAC_JSON` bằng email Google Workspace thật và role tương ứng.
- [ ] Chọn deployment access phù hợp để `Session.getActiveUser().getEmail()` trả identity đáng tin cậy; nếu email trống thì write phải bị chặn.
- [ ] Đặt URL deployment vào frontend qua `VITE_APPS_SCRIPT_WEB_APP_URL`.
- [ ] Tạo Apps Script client adapter phía frontend cho read/write.
- [ ] Bổ sung optimistic/concurrency check theo record/version nghiệp vụ ngoài `LockService`.
- [ ] Authentication/authorization UI thực tế để demo actor constant không còn được dùng cho production workflow.
- [ ] Segregation `performedBy != verifierId`: lấy performer authoritative từ `Maintenance_Execution` và enforce trong Apps Script + domain.
- [ ] Integration tests với fixture/sandbox data, không dùng production rows.

Không bật production live write cho đến khi các gate còn lại hoàn tất và Quality Gate + preview deployment đều xanh.
