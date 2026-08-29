# Hệ thống quản lý thiết bị IATF 16949

Ứng dụng quản lý thiết bị sản xuất, thiết bị đo kiểm, bảo trì, hiệu chuẩn, dụng cụ sản xuất và truy vết lịch sử theo nguyên tắc **một nguồn dữ liệu gốc**.

## Nguyên tắc kiến trúc bắt buộc

**Một thiết bị = một mã = một hồ sơ gốc = một lịch sử xuyên suốt.**

`Equipment_Master` là danh mục thiết bị gốc duy nhất.

Từ một hồ sơ gốc, thiết bị được phân loại thành:

- `PRODUCTION`: thiết bị sản xuất;
- `MEASUREMENT`: thiết bị đo kiểm / QC.

Các module bảo trì, kiểm tra ngày, downtime, bàn giao và hiệu chuẩn chỉ tham chiếu cùng `equipmentId`. Không tạo mã thiết bị riêng theo từng phòng ban hoặc từng nghiệp vụ.

Xem chi tiết tại:

- `docs/KIEN_TRUC_LUONG_HE_THONG.md`
- `docs/SOURCE_FIRST_IMPLEMENTATION_PLAN.md`

## Phạm vi hệ thống

- Danh mục và lý lịch thiết bị BM-TBSX-01/02.
- Kiểm tra thiết bị hằng ngày BM-KTTBHN.
- Kế hoạch và Work Order bảo trì.
- Thực hiện, kết quả, lịch sử sửa chữa.
- Bàn giao thiết bị BM-TBSX-05.
- Downtime và KPI BM-TBSX-06.
- Jig, gá và dụng cụ sản xuất BM-TBSX-09/10/11.
- Quản lý thiết bị đo và hiệu chuẩn.
- Lịch sử di chuyển thiết bị.
- Audit Log.
- Google Drive cho hình ảnh, chứng nhận và tài liệu bằng chứng.

## Ranh giới hệ thống production

Google Apps Script là ranh giới duy nhất cho persistence và workflow production.

```text
Trình duyệt
    ↓
google.script.run
    ↓
Google Apps Script
    ├── Google Sheets
    └── Google Drive
```

Không dùng Vercel/serverless hoặc Node API để ghi dữ liệu production.

Trình duyệt không giữ Google credential và không được tự quyết định danh tính hay quyền người dùng.

Danh tính authoritative lấy từ:

```text
Session.getActiveUser().getEmail()
```

Quyền lấy từ Script Property `RBAC_JSON`.

## Dữ liệu production

Nguồn nghiệp vụ chuẩn nằm trong `source/`.

Không tự tạo dữ liệu giao dịch production từ template hoặc ví dụ.

Dữ liệu hiện đã có nguồn hỗ trợ:

- `Equipment_Master`: 19 thiết bị từ BM-TBSX-02;
- `Calibration_Master`: 48 bản ghi nguồn hiệu chuẩn;
- `Calibration_Vendor_Quote`: 230 bản ghi báo giá lịch sử;
- `Calibration_Quote_Summary`: 5 bản tổng hợp nhà cung cấp.

Các bảng giao dịch bảo trì / kiểm tra chỉ được ghi khi có giao dịch thực tế hoặc fixture kiểm thử riêng.

## Quản trị Equipment Master

Trong giai đoạn hiện tại, chỉ `ADMIN` được phép thay đổi Equipment Master.

Các thao tác gồm:

- thêm thiết bị;
- sửa thông tin;
- ngừng sử dụng;
- khôi phục;
- thanh lý;
- xóa an toàn thiết bị chưa có lịch sử.

Thiết bị đã phát sinh giao dịch không được xóa vật lý. Hệ thống giữ lịch sử và chuyển trạng thái ngừng sử dụng / thanh lý.

## Trạng thái phát triển

PR hiện tại chưa được phép merge cho đến khi các live gate hoàn tất, bao gồm triển khai Apps Script, smoke test workflow và full integration test.
