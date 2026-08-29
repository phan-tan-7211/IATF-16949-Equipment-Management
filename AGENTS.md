# AGENTS.md — Quy tắc kiến trúc bắt buộc

Tài liệu này là **quy tắc bắt buộc** cho mọi dev, AI agent và người bảo trì repository này. Nếu implementation hoặc hướng dẫn nào mâu thuẫn với tài liệu này thì phải dừng lại và sửa kiến trúc trước khi tiếp tục.

## 1. Kiến trúc production chính thức

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

### Vai trò từng lớp

1. **Vercel Frontend**
   - Là giao diện production chính thức.
   - Mọi UI/UX người dùng sử dụng phải được phát triển trong frontend React tại `src/`.
   - Dashboard, Thiết bị, Kiểm tra hằng ngày, Bảo trì, Tooling, Hiệu chuẩn, Admin/Config đều ưu tiên triển khai tại đây.
   - Yêu cầu giao diện professional, responsive mobile/tablet/desktop.

2. **Apps Script Backend**
   - Là backend/workflow boundary.
   - Chịu trách nhiệm business rules, validation, RBAC, audit, idempotency, transaction guard, persistence adapter.
   - Không được biến Apps Script HTML thành frontend production thay cho Vercel.

3. **Google Sheets / Google Drive**
   - Là lớp dữ liệu và evidence storage.
   - Google Sheets lưu structured data.
   - Google Drive lưu hình ảnh, chứng nhận, tài liệu và bằng chứng.

4. **`AppShell`**
   - Chỉ là **màn hình test kỹ thuật của backend**.
   - Dùng cho smoke test, debug, diagnostic và kiểm trực tiếp Apps Script workflow.
   - **Không phải frontend production.**
   - Không được dùng việc AppShell render tốt làm lý do bỏ qua hoặc trì hoãn frontend Vercel.

## 2. Quy tắc chống architecture drift

- Không phát triển chức năng UI production mới chỉ trong `apps-script/AppShell*`.
- Nếu backend có chức năng mới, phải xác định luôn frontend Vercel tương ứng cần thêm/sửa gì.
- `AppShell` có thể có control tối thiểu để test backend, nhưng không được trở thành sản phẩm UI cuối.
- Một task được coi là hoàn thành về product chỉ khi frontend Vercel đã hỗ trợ chức năng đó, trừ khi task được ghi rõ là backend-only.
- Khi review PR, phải kiểm tra xem thay đổi có vô tình chuyển trách nhiệm frontend sang Apps Script HTML hay không.
- Không được bỏ quên `src/` trong các phase triển khai feature.

## 3. Quy tắc dữ liệu thiết bị

**Một thiết bị = một mã = một hồ sơ gốc = một lịch sử xuyên suốt.**

- `Equipment_Master` là hồ sơ gốc duy nhất cho thiết bị.
- `equipmentType` dùng `PRODUCTION` hoặc `MEASUREMENT`.
- Các nghiệp vụ kiểm tra, bảo trì, downtime, bàn giao và hiệu chuẩn chỉ tham chiếu cùng `equipmentId`.
- Không tạo hệ mã thiết bị song song theo phòng ban/nghiệp vụ.

## 4. Checklist bắt buộc trước khi kết thúc một feature

- Backend Apps Script đã có business rule và guard cần thiết.
- Google Sheets/Drive schema và persistence đúng.
- Frontend Vercel trong `src/` đã có UI/UX tương ứng nếu feature có người dùng thao tác.
- AppShell chỉ được dùng để test backend.
- Build/test/lint frontend PASS.
- Không tạo duplicate architecture hoặc duplicate source of truth.

## 5. Quy tắc ưu tiên khi có mâu thuẫn

Nếu có lựa chọn giữa:

- làm UI nhanh trong AppShell; hoặc
- triển khai UI production đúng trong Vercel frontend,

thì **luôn chọn Vercel frontend**. AppShell chỉ bổ sung sau nếu cần test kỹ thuật.
