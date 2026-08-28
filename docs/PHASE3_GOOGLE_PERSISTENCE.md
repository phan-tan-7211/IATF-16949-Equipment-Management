# Phase 3 — Google persistence

## Trạng thái

- G1 contract: `G1-frozen-2026-08-28`
- Canonical Google Sheet: `1zvrMyGDnXy3HMRzFrLYS4IFyuYPsSUTROy22M6Le9VE`
- Project Drive folder: `1hxow8p4gir4KRJZUMhEntsrazjAqfVGI`
- Locale: `vi_VN`
- Time zone: `Asia/Ho_Chi_Minh` (Google có thể hiển thị alias `Asia/Saigon`)
- Frontend direct Google API: **không cho phép**
- Persistence boundary: **backend/serverless required**
- Backend health route: `/api/persistence-health`
- Server credential gate: `GOOGLE_SERVICE_ACCOUNT_JSON`

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

## Bảo mật và kiến trúc

ID của Sheet/folder là locator không bí mật và được phép nằm trong source code. OAuth token, refresh token, service-account JSON, private key và mọi credential Google **không được** commit vào repo và **không được** đưa vào bundle Vite.

UI chỉ gọi API nội bộ của ứng dụng. API/serverless layer chịu trách nhiệm:

1. xác thực người dùng;
2. kiểm tra RBAC và segregation-of-duties;
3. validate payload bằng contract/schema;
4. ghi Google Sheets/Drive;
5. append `Audit_Log`;
6. trả kết quả transaction về UI.

`/api/persistence-health` hiện chỉ xác nhận backend boundary và tình trạng credential. Endpoint không trả giá trị secret và chưa thực hiện Google write.

## Gate đã hoàn tất

- [x] G1 schema/workflow/persistence contract freeze.
- [x] Canonical Google Sheet + 9 Drive evidence folders.
- [x] Source seeding Calibration và Equipment.
- [x] React workflow transition tách thành pure domain execution; không còn side effect lồng trong `setWorkOrders` updater.
- [x] Mobile navigation truy cập đủ 7 workspace.
- [x] Workflow action map sang governance policy và role-gate trước transition.
- [x] Requester self-approval bị chặn.
- [x] Backend/serverless health boundary được tạo.

## Gate còn lại trước live write

- [ ] Cấu hình `GOOGLE_SERVICE_ACCOUNT_JSON` ở server/deployment environment; không gửi credential qua browser hoặc commit vào GitHub.
- [ ] Google Sheets/Drive read/write adapter phía backend.
- [ ] Idempotency key và optimistic/concurrency protection cho write.
- [ ] Append-only `Audit_Log` write trong cùng transaction boundary logic.
- [ ] Authentication thực tế để actor ID/role không còn là demo constant.
- [ ] Segregation `performedBy != verifierId`: domain rule đã có nhưng G1 workflow UI chưa có performer identity authoritative để enforce end-to-end; cần lấy performer từ `Maintenance_Execution` khi backend adapter hoạt động.
- [ ] Integration tests với Google adapter bằng test fixture/sandbox data, không dùng production rows.

Không bật production live write cho đến khi các gate còn lại được hoàn tất và Quality Gate + preview deployment đều xanh.
