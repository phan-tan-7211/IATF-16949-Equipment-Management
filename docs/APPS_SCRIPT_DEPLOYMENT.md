# Apps Script Web App deployment

## Mục tiêu

Apps Script là persistence boundary duy nhất cho Google Sheets/Drive. Frontend không giữ Google credential và không gọi trực tiếp Sheets/Drive API.

## Project source

Deploy nội dung trong thư mục `apps-script/`:

- `Code.gs`
- `appsscript.json`

Canonical storage:

- Spreadsheet ID: `1zvrMyGDnXy3HMRzFrLYS4IFyuYPsSUTROy22M6Le9VE`
- Project folder ID: `1hxow8p4gir4KRJZUMhEntsrazjAqfVGI`
- Contract: `G1-frozen-2026-08-28`

## Bắt buộc trước khi deploy

1. Tạo hoặc mở một standalone Apps Script project thuộc tài khoản Google Workspace có quyền với canonical Sheet.
2. Copy `Code.gs` và manifest vào project.
3. Trong **Project Settings → Script properties**, tạo `RBAC_JSON`.
4. Giá trị `RBAC_JSON` là JSON map email → role, ví dụ:

```json
{
  "supervisor@example.com": "SUPERVISOR",
  "maintenance@example.com": "MAINTENANCE",
  "quality@example.com": "QUALITY"
}
```

Role hợp lệ hiện tại: `OPERATOR`, `MAINTENANCE`, `SUPERVISOR`, `QUALITY`, `MANAGER`, `ADMIN`.

Không commit danh sách email thật nếu repo public.

## Deploy Web App

Tạo deployment mới kiểu **Web app**.

Yêu cầu bảo mật:

- **Execute as:** user accessing the web app.
- **Who has access:** chỉ nhóm/tổ chức Google Workspace cần dùng hệ thống; không mở public anonymous.
- URL sử dụng phải là URL production deployment kết thúc bằng `/exec`, không dùng `/dev`.

Lý do: RBAC server-side dùng `Session.getActiveUser().getEmail()`. Nếu Apps Script không được phép biết active user, request sẽ fail đóng với `AUTHENTICATION_REQUIRED` thay vì dùng identity giả từ browser.

## Frontend configuration

Sau khi deployment hoạt động, đặt URL vào frontend environment:

```text
VITE_APPS_SCRIPT_WEB_APP_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
```

Frontend adapter chỉ chấp nhận HTTPS URL trên `script.google.com` kết thúc bằng `/exec`.

## Smoke test bắt buộc

### 1. Health

Mở:

```text
<WEB_APP_URL>?action=health
```

Kỳ vọng:

```json
{
  "ok": true,
  "provider": "GOOGLE_APPS_SCRIPT",
  "boundary": "APPS_SCRIPT_WEB_APP",
  "contractVersion": "G1-frozen-2026-08-28",
  "authenticated": true
}
```

Nếu `authenticated=false`, không bật live persistence.

### 2. Authorized read

GET:

```text
<WEB_APP_URL>?action=readTable&table=Equipment_Master
```

Kỳ vọng `ok=true`, actor là email người dùng hiện tại và rows trả về từ canonical Sheet.

### 3. Unauthorized write

Dùng tài khoản role không đủ quyền để gọi write. Kỳ vọng `ROLE_NOT_ALLOWED` và không phát sinh row/audit.

### 4. Idempotency

Gửi cùng một `operationId` hai lần. Kỳ vọng lần hai:

```json
{
  "ok": true,
  "duplicate": true
}
```

Không được phát sinh row dữ liệu hoặc audit thứ hai.

## Production gates còn lại

- [x] Apps Script-only boundary.
- [x] Frozen table allowlist.
- [x] Server-side identity lookup.
- [x] RBAC role map.
- [x] `LockService` critical section.
- [x] Durable idempotency lookup thông qua append-only `Audit_Log`.
- [x] Frontend Apps Script client adapter + URL allowlist.
- [ ] Deploy Web App thật và xác nhận active user email.
- [ ] Cấu hình `RBAC_JSON` thật.
- [ ] Gắn `VITE_APPS_SCRIPT_WEB_APP_URL` vào preview frontend.
- [ ] End-to-end read smoke test.
- [ ] End-to-end write/idempotency smoke test bằng fixture riêng.
- [ ] `performedBy != verifierId` từ `Maintenance_Execution` trước khi VERIFY.
- [ ] Optimistic concurrency cho record update.
- [ ] Evidence upload qua Drive adapter.

Không merge PR vào `main` trước khi các gate live persistence bắt buộc được xác nhận.
