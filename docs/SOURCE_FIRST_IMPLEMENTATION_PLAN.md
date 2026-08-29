# Source-first implementation plan

## Nguyên tắc

Thư mục `source/` là nguồn nghiệp vụ chuẩn. Ứng dụng không tự tạo biểu mẫu thay thế nếu trong hệ thống đã có BM tương ứng.

- Nhập dữ liệu một lần.
- Tái sử dụng cùng dữ liệu để tạo lịch sử, KPI và biểu mẫu A4.
- Workflow điện tử phải phản ánh luồng QT-TBSX/BM hiện hành.
- Dữ liệu giá tiền/chi phí có trong `source/` được giữ lại khi có giá trị nghiệp vụ, nhưng phải tách khỏi master vận hành và ghi rõ mốc lịch sử/nguồn để không bị hiểu là giá live.
- Không kết nối Google Sheets/Drive trước khi schema và workflow được khóa.

## Mapping nguồn → chức năng

| Nguồn | Chức năng ứng dụng | Dữ liệu chính |
| --- | --- | --- |
| BM-TBSX-01 | Equipment Profile / History | thông tin thiết bị + timeline |
| BM-TBSX-02 | Equipment Master | danh mục, vị trí, bộ phận, chu kỳ BD |
| BM-TBSX-03 | Maintenance Plan | kế hoạch + checklist + tiêu chuẩn/phương pháp |
| BM-TBSX-04 | Maintenance/Repair Log | lịch sử công việc thực tế |
| BM-TBSX-05 | Equipment Handover | bàn giao, tình trạng, xác nhận nhận máy |
| BM-TBSX-06 | Downtime/KPI Report | downtime, MTBF, MTTR |
| BM-TBSX-07 | Maintenance Work Order | yêu cầu/phê duyệt/công việc dự báo |
| BM-TBSX-08 | Maintenance Execution Result | kết quả ○/△/× theo hạng mục |
| BM-TBSX-09 | Tooling Master | jig/gá/khuôn/dụng cụ + ownership |
| BM-TBSX-10 | Tooling Maintenance Plan | kiểm tra, bảo trì, perishable replacement |
| BM-TBSX-11 | Tooling Change Control | ECN, sửa đổi, phê duyệt, cập nhật tài liệu |
| BM-KTTBHN | Daily Inspection | V/○/△/X + escalation |
| BM-STCL-03 / danh sách hiệu chuẩn | Calibration Master + Calibration Log + Vendor Quote History | thiết bị đo, lịch hiệu chuẩn, mục đích, báo giá lịch sử theo nhà cung cấp |

## Workflow mục tiêu

```text
Equipment register (BM01/02)
    ↓
Daily inspection (BM-KTTBHN)
    ├─ V → record only
    ├─ △ → maintenance request
    └─ X → equipment DOWN + downtime event + work order

Maintenance plan (BM03)
    ↓
Work order (BM07)
    ↓
Execution/result (BM08)
    ↓
Maintenance log (BM04)
    ↓
Verification / test run
    ↓
Handover & release (BM05)
    ↓
Downtime/KPI calculation (BM06)
```

Tooling:

```text
Tooling Master (BM09)
    ↓
Maintenance / replacement plan (BM10)
    ↓
Inspection / repair

Design or physical change
    ↓
Change control (BM11)
    ↓
Approval / QA confirmation when required
    ↓
Update drawings + BM09 + related documents
```

Calibration:

```text
Calibration Master
    ↓
Calibration due plan
    ↓
Calibration execution / certificate
    ↓
Calibration Log

Source quotation snapshot
    ↓
Vendor Quote History (year/source/provider/item)
```

## Giai đoạn triển khai

### Phase 1 — Domain foundation

- Source mapping.
- Equipment Master schema.
- Daily inspection schema.
- Maintenance Plan / Work Order / Execution schema.
- Handover and Downtime schema.
- Tooling Master / Maintenance / Change schema.
- Calibration Master / Log / historical vendor quote schema.
- Audit model.
- Unit tests for core validation.

**Không cần Google Sheets/Drive.**

### Phase 2 — Local UI workflow

- Equipment list/profile.
- QR entry point.
- Daily inspection form.
- Maintenance plan/work order/result screens.
- Handover screen.
- Tooling master/change screens.
- Calibration master/due/quote history screens.
- KPI calculation services using in-memory/mock data.

**Không cần Google Sheets/Drive.**

### Gate G1 — Schema freeze

Chỉ qua G1 khi:

1. Mỗi BM01–11, BM-KTTBHN và nguồn hiệu chuẩn đã map được sang schema/UI hoặc report rõ ràng.
2. Không còn field nghiệp vụ quan trọng chưa quyết định.
3. Workflow state transition đã có test.
4. Các trường dùng tính downtime/MTBF/MTTR đã ổn định.
5. Quy tắc approval/RBAC đã chốt.
6. Dữ liệu chi phí lịch sử đã được tách khỏi master vận hành, có source snapshot rõ ràng.

### Phase 3 — Google persistence

**Đây là thời điểm cần liên kết Google Sheets và Google Drive.**

Google Sheets dùng cho dữ liệu có cấu trúc:

- Equipment_Master
- Daily_Inspection / Daily_Inspection_Item
- Maintenance_Plan / Maintenance_Plan_Item
- Maintenance_Work_Order
- Maintenance_Execution / Maintenance_Result_Item
- Maintenance_Log
- Equipment_Handover
- Downtime_Event
- Tooling_Master
- Tooling_Maintenance_Plan
- Tooling_Modification
- Calibration_Master
- Calibration_Log
- Calibration_Vendor_Quote_History
- Equipment_Movement_Log
- Audit_Log

Google Drive dùng cho evidence/tài liệu:

- Ảnh thiết bị.
- Manual / setup document.
- Ảnh trước/sau sửa chữa.
- Certificate hiệu chuẩn + ảnh tem.
- Drawing/jig document.
- ECN/change attachment.
- Snapshot PDF/A4 chính thức.

Kết nối qua backend/API; frontend không lưu Google credential.

### Phase 4 — Audit-ready

- Auth/RBAC.
- Approval segregation.
- Immutable audit log.
- State transition guards.
- A4/PDF renderer.
- KPI dashboard.
- Export audit package.

## Thông báo khi đạt G1

Khi đạt Gate G1, cần báo rõ:

> Đã đến bước cần liên kết Google Sheets/Drive. Schema nghiệp vụ đã ổn định; tiếp theo sẽ tạo/ánh xạ bảng dữ liệu và thư mục evidence.
