# Hệ thống quản lý thiết bị IATF 16949

Ứng dụng quản lý thiết bị sản xuất, thiết bị đo kiểm, bảo trì, hiệu chuẩn, dụng cụ sản xuất và truy vết lịch sử theo nguyên tắc **một nguồn dữ liệu gốc**.

> **Quy tắc bắt buộc cho dev/AI:** đọc `AGENTS.md` trước khi thay đổi kiến trúc hoặc triển khai feature.

## Nguyên tắc kiến trúc bắt buộc

**Một thiết bị = một mã = một hồ sơ gốc = một lịch sử xuyên suốt.**

`Equipment_Master` là danh mục thiết bị gốc duy nhất.

Từ một hồ sơ gốc, thiết bị được phân loại thành:

- `PRODUCTION`: thiết bị sản xuất;
- `MEASUREMENT`: thiết bị đo kiểm / QC.

Các module bảo trì, kiểm tra ngày, downtime, bàn giao và hiệu chuẩn chỉ tham chiếu cùng `equipmentId`. Không tạo mã thiết bị riêng theo từng phòng ban hoặc từng nghiệp vụ.

Xem chi tiết tại:

- `AGENTS.md`
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

## Kiến trúc production chính thức

```text
Người dùng
    ↓
Vercel Frontend
React + Vite + TypeScript (`src/`)
    ↓
Apps Script Backend (`apps-script/`)
    ↓
Google Sheets / Google Drive
```

### 1. Vercel Frontend

- Là **frontend production chính thức** của hệ thống.
- Tất cả UI/UX người dùng thực tế sử dụng phải được phát triển trong `src/`.
- Dashboard, Thiết bị, Kiểm tra hằng ngày, Bảo trì, Tooling, Hiệu chuẩn và Admin/Config phải có giao diện React tương ứng.
- Không được bỏ quên frontend Vercel khi backend đã có chức năng.

### 2. Apps Script Backend

Google Apps Script là backend/workflow boundary cho production.

Backend chịu trách nhiệm:

- business rule;
- validation;
- RBAC/identity;
- audit;
- idempotency;
- transaction guard;
- đọc/ghi Google Sheets và Google Drive.

Không dùng Vercel/serverless hoặc Node API để ghi trực tiếp vào Google Sheets/Drive production nếu chưa có thay đổi kiến trúc được phê duyệt.

### 3. Google Sheets / Google Drive

- Google Sheets: structured persistence.
- Google Drive: hình ảnh, chứng nhận, manual, tài liệu setup và evidence.

### 4. AppShell

`apps-script/AppShell*` chỉ là **màn hình test kỹ thuật của backend**.

Mục đích:

- smoke test;
- debug;
- diagnostic;
- kiểm trực tiếp workflow Apps Script.

**AppShell không phải frontend production và không được thay thế frontend Vercel.**

Việc AppShell chạy/render đúng chỉ chứng minh backend test shell hoạt động; không có nghĩa feature đã hoàn thành ở cấp sản phẩm nếu frontend Vercel chưa có UI tương ứng.

## Quy tắc chống architecture drift

- Không phát triển feature UI production chỉ trong AppShell.
- Khi thêm chức năng backend, phải xác định và triển khai frontend Vercel tương ứng nếu người dùng cần thao tác.
- AppShell chỉ được giữ control tối thiểu phục vụ test backend.
- Review PR phải kiểm tra cả `src/` và `apps-script/` để tránh bỏ quên frontend.
- Nếu phải lựa chọn giữa làm UI nhanh trong AppShell và làm đúng trong Vercel frontend, ưu tiên **Vercel frontend**.

## Identity / quyền

Frontend không giữ Google credential và không được tự quyết định danh tính hay quyền người dùng.

Danh tính authoritative phía Apps Script lấy từ:

```text
Session.getActiveUser().getEmail()
```

Quyền lấy từ Script Property `RBAC_JSON`.

## Dữ liệu production

Nguồn nghiệp vụ chuẩn nằm trong `source/` và các nguồn nghiệp vụ được người quản trị xác nhận.

Không tự tạo dữ liệu giao dịch production từ template hoặc ví dụ nếu chưa được phê duyệt.

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
