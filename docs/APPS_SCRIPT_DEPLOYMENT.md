# Apps Script Web App deployment

## Mục tiêu

Apps Script là persistence boundary duy nhất cho Google Sheets/Drive. UI production chạy trực tiếp bằng **Apps Script HTMLService** và gọi server bằng `google.script.run`. Frontend không giữ Google credential và không gọi trực tiếp Sheets/Drive API.

Browser cross-origin `fetch()` từ Vercel/Netlify tới Apps Script `/exec` đã được kiểm thử và không được dùng làm production transport vì redirect/CORS. Iframe bridge cũng không được dùng cho production vì embedded Google authentication không ổn định. Production browser path là **first-party Apps Script HTMLService**.

## Project source

Deploy nội dung trong thư mục `apps-script/`:

- `Code.gs`
- `Maintenance.gs`
- `AppShell.html`
- `Bridge.html` — diagnostic/legacy transport, không phải production path
- `appsscript.json`

Canonical storage:

- Spreadsheet ID: `1zvrMyGDnXy3HMRzFrLYS4IFyuYPsSUTROy22M6Le9VE`
- Project folder ID: `1hxow8p4gir4KRJZUMhEntsrazjAqfVGI`
- Contract: `G1-frozen-2026-08-28`

## Bắt buộc trước khi deploy

1. Tạo hoặc mở standalone Apps Script project thuộc tài khoản Google Workspace có quyền với canonical Sheet.
2. Copy `Code.gs`, `Maintenance.gs`, `AppShell.html` và manifest vào project. Có thể giữ `Bridge.html` cho diagnostic nhưng không dùng cho production UI.
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

`ALLOWED_PARENT_ORIGINS_JSON` chỉ cần nếu tiếp tục dùng `Bridge.html` cho diagnostic iframe. Nó không còn là yêu cầu của production first-party UI.

## Deploy Web App

Tạo deployment mới kiểu **Web app** hoặc cập nhật deployment hiện có bằng **New version**.

Yêu cầu bảo mật:

- **Execute as:** user accessing the web app.
- **Who has access:** chỉ nhóm/tổ chức Google Workspace cần dùng hệ thống; không mở public anonymous.
- URL production phải kết thúc bằng `/exec`, không dùng `/dev`.

Lý do: RBAC server-side dùng `Session.getActiveUser().getEmail()`. Nếu Apps Script không được phép biết active user, request sẽ fail đóng với `AUTHENTICATION_REQUIRED` thay vì dùng identity giả từ browser.

Sau mỗi thay đổi `Code.gs`, `Maintenance.gs` hoặc HTMLService file, phải **Save → Manage deployments → Edit → New version → Deploy**. Save trong editor không tự thay snapshot deployment hiện tại.

## URL production

### Health

```text
<WEB_APP_URL>?action=health
```

### Production UI

```text
<WEB_APP_URL>?action=app
```

`AppShell.html` chạy first-party trong Apps Script và gọi server-side bằng `google.script.run`.

## Smoke test bắt buộc

### 1. Direct health

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

### 2. First-party UI read

Mở:

```text
<WEB_APP_URL>?action=app
```

Production read path:

```text
AppShell.html
  → google.script.run
  → bridgeInvoke(request)
  → executeTransportRequest_
  → readTable_(Equipment_Master)
  → canonical Google Sheet
```

Kỳ vọng với seed hiện tại:

- actor là email user được Apps Script xác thực
- `read.ok = true`
- `read.table = Equipment_Master`
- `rowCount = 19`
- UI hiển thị Equipment Master read-only

Live verification ngày 2026-08-28 đã đạt đầy đủ các điều kiện trên.

### 3. Unauthorized write

Dùng tài khoản role không đủ quyền để gọi write. Kỳ vọng `ROLE_NOT_ALLOWED` và không phát sinh row/audit.

### 4. Idempotency

Gửi cùng một `operationId` hai lần trong **isolated test fixture**, không dùng production/source rows. Kỳ vọng lần hai:

```json
{
  "ok": true,
  "duplicate": true
}
```

Không được phát sinh row dữ liệu hoặc audit thứ hai.

## Production gates

- [x] Apps Script-only boundary.
- [x] Frozen table allowlist.
- [x] Server-side identity lookup.
- [x] RBAC role map contract và live RBAC hoạt động.
- [x] `LockService` critical section.
- [x] Durable idempotency lookup thông qua append-only `Audit_Log`.
- [x] Compensating rollback cho append/maintenance multi-step writes.
- [x] Apps Script Web App deploy thật và direct health xác nhận `authenticated=true`.
- [x] First-party HTMLService + `google.script.run` transport được xác nhận live.
- [x] Canonical `Equipment_Master` read smoke test đạt 19 dòng.
- [x] Equipment Master live read-only UI đã có trong `AppShell.html`.
- [ ] End-to-end write/idempotency smoke test bằng fixture riêng.
- [ ] Maintenance transition negative-case smoke test.
- [ ] Nối maintenance UI live với server transition response.
- [ ] Persist BM-05 thật trước RELEASE.
- [ ] Optimistic concurrency cho record update ngoài maintenance.
- [ ] Evidence upload qua Drive adapter.
- [ ] Hoàn tất các workspace HTMLService còn lại.

Không merge PR vào `main` trước khi các gate live write bắt buộc được xác nhận.