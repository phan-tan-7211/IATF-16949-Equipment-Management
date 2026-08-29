# Ma trận kiểm thử fixture và live

> Mục tiêu: kiểm thử đầy đủ nhưng **không được ghi dữ liệu thử vào 19 thiết bị production hoặc các bảng nghiệp vụ production**.

## 1. Nguyên tắc bắt buộc

- `TEST_SPREADSHEET_ID` phải khác canonical Spreadsheet ID.
- Mọi test tạo/sửa/xóa phải chạy trên fixture hoặc test scope riêng.
- Production chỉ được dùng cho read smoke hoặc giao dịch nghiệp vụ thật đã được người dùng thực hiện.
- Không dùng dữ liệu ví dụ trong source để tạo transaction production.
- Mỗi write smoke phải có `operationId` và kiểm idempotency.
- Mỗi write smoke phải kiểm Audit Log tương ứng.

## 2. Ma trận

| Nhóm | Test | Phạm vi | Điều kiện đạt |
| --- | --- | --- | --- |
| Equipment | Tạo thiết bị | Fixture | tạo đúng 1 row + 1 audit |
| Equipment | Gửi lại cùng operationId | Fixture | không tăng row/audit |
| Equipment | Sửa đúng `updatedAt` | Fixture | cập nhật thành công |
| Equipment | Sửa với version cũ | Fixture | `EQUIPMENT_VERSION_CONFLICT` |
| Equipment | Xóa chưa có lịch sử | Fixture | xóa được + audit |
| Equipment | Xóa đã có lịch sử | Fixture | `EQUIPMENT_HAS_HISTORY` |
| Daily | V bình thường | Fixture | chỉ tạo Daily Inspection |
| Daily | X dừng máy | Fixture | Daily + Work Order + Downtime + Audit nguyên tử |
| Maintenance | role sai phê duyệt | Fixture/pure guard | `ROLE_NOT_ALLOWED` |
| Maintenance | requester tự phê duyệt | Fixture/pure guard | `SELF_APPROVAL_FORBIDDEN` |
| Maintenance | performer tự xác nhận | Fixture/pure guard | `SELF_VERIFICATION_FORBIDDEN` |
| BM-05 | tạo trước VERIFIED | Fixture | bị chặn |
| BM-05 | đúng VERIFIED | Fixture | tạo handover |
| BM-05 | sai người nhận xác nhận | Fixture | bị chặn |
| BM-05 | `NOT_OPERABLE` rồi RELEASE | Fixture | bị chặn |
| BM-05 | accepted + operable rồi RELEASE | Fixture | RELEASED |
| Calibration | link vào non-MEASUREMENT | Fixture | bị chặn |
| Calibration | link đúng MEASUREMENT | Fixture | liên kết + audit |
| Calibration | link với expected value cũ | Fixture | conflict |
| Calibration | ghi calibration chưa link master | Fixture | bị chặn |
| Calibration | ghi calibration hợp lệ | Fixture | 1 Calibration_Log + audit |
| Calibration | đánh giá PASS | Fixture | đánh giá thành công |
| Calibration | LIMITED_USE không note | Fixture/domain | bị chặn |
| Calibration | FAIL không note | Fixture/domain | bị chặn |
| Calibration | đánh giá lần hai | Fixture | `CALIBRATION_ALREADY_EVALUATED` |
| Tooling BM-09 | tạo tooling | Fixture | Tooling_Master + audit |
| Tooling BM-10A | tạo plan cho tooling không tồn tại | Fixture | bị chặn |
| Tooling BM-10A | tạo plan hợp lệ | Fixture | Tooling_Maintenance_Plan + audit |
| Tooling BM-11 | tạo thay đổi | Fixture | trạng thái IN_PROGRESS |
| Tooling BM-11 | người đề xuất tự duyệt | Fixture | `SELF_APPROVAL_FORBIDDEN` |
| Tooling BM-11 | complete chưa approved | Fixture | bị chặn |
| Tooling BM-11 | complete thiếu updatedDocuments | Fixture | bị chặn |
| Tooling BM-11 | approve + complete đúng | Fixture | COMPLETED + audit |
| KPI | không có ngày kiểm tra | Fixture/read model | `hasRuntimeData=false` |
| KPI | có ngày kiểm tra + downtime | Fixture/read model | tính đúng runtime/downtime/MTBF/MTTR |
| Drive | folder không thuộc allowlist | Fixture/test file | bị chặn |
| Drive | file quá giới hạn | Fixture/test file | bị chặn |
| Drive | upload hợp lệ | Fixture/test file | file + audit; rollback nếu audit lỗi |
| AppShell | tải 7 workspace | Live read-only | không lỗi HTMLService |
| AppShell | session/RBAC | Live read-only | actor/role lấy server-side |
| Production | đọc Equipment_Master | Live read-only | đúng 19 source rows trước khi có thay đổi nghiệp vụ thật |

## 3. Production smoke được phép

Chỉ các thao tác không làm thay đổi dữ liệu:

```text
?action=health
?action=app
read Equipment_Master
read Calibration_Master
read Tooling tables
read KPI source tables
sessionInfo
```

Không dùng production để thử:

- Equipment create/update/delete;
- Daily X;
- Work Order giả;
- Calibration giả;
- Tooling giả;
- Evidence file giả.

## 4. Quy tắc cleanup fixture

Fixture có thể giữ test rows để audit, nhưng phải dùng tiền tố rõ ràng:

```text
FX-EQ-
FX-WO-
FX-CAL-
FX-TL-
```

Nếu có cleanup tự động:

- chỉ xóa row trong `TEST_SPREADSHEET_ID`;
- kiểm lại Spreadsheet ID trước mọi delete;
- nếu trùng canonical ID thì fail đóng ngay.

## 5. Gate trước merge

Chỉ được đánh dấu integration PASS khi:

- CI Test + Build + Lint PASS;
- fixture idempotency PASS;
- negative RBAC/self-approval/self-verification PASS;
- Equipment lifecycle PASS;
- Daily X atomic flow PASS;
- BM-05 release guard PASS;
- Calibration link → log → đánh giá sau hiệu chuẩn PASS;
- Tooling BM-09/10A/11 PASS;
- KPI monthly PASS;
- Drive Evidence PASS;
- AppShell live read-only smoke PASS.

Sau đó mới được xem xét merge PR.
