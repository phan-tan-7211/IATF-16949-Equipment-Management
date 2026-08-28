# Apps Script Web App deployment

## Mục tiêu

Apps Script là persistence boundary duy nhất cho Google Sheets/Drive. Frontend không giữ Google credential và không gọi trực tiếp Sheets/Drive API.

Browser cross-origin `fetch()` trực tiếp tới Apps Script `/exec` không phải transport production vì ContentService redirect/CORS có thể chặn frontend chạy trên Vercel/Netlify. Production browser transport dùng **Apps Script HTMLService bridge** được nhúng bằng iframe, giao tiếp với parent qua `postMessage`, sau đó gọi server-side bằng `google.script.run`.

## Project source

Deploy nội dung trong thư mục `apps-script/`:

- `Code.gs`
- `Maintenance.gs`
- `Bridge.html`
- `appsscript.json`

Canonical storage:

- Spreadsheet ID: `1zvrMyGDnXy3HMRzFrLYS4IFyuYPsSUTROy22M6Le9VE`
- Project folder ID: `1hxow8p4gir4KRJZUMhEntsrazjAqfVGI`
- Contract: `G1-frozen-2026-08-28`

## Bắt buộc trước khi deploy

1. Tạo hoặc mở một standalone Apps Script project thuộc tài khoản Google Workspace có quyền với canonical Sheet.
2. Copy `Code.gs`, `Maintenance.gs`, `Bridge.html` và manifest vào project.
3. Trong **Project Settings → Script properties**, tạo `RBAC_JSON`.
4. Giá trị `RBAC_JSON` là JSON map email → role, ví dụ:

```json
{
  "supervisor@example.com": "SUPERVISOR",
  "maintenance@example.com": "MAINTENANCE",
  "quality@example.com": "QUALITY"
}
```

5. Tạo thêm `ALLOWED_PARENT_ORIGINS_JSON`. Giá trị là JSON array chứa **origin chính xác** của frontend được phép nhúng bridge, không có path hoặc dấu `/` cuối. Ví dụ:

```json
[
  "https://deploy-preview-1--iatf-16949-equipment-management.netlify.app"
]
```

Khi thêm production/Vercel origin, thêm từng origin chính xác vào array. Không dùng wildcard.

Role hợp lệ hiện tại: `OPERATOR`, `MAINTENANCE`, `SUPERVISOR`, `QUALITY`, `MANAGER`, `ADMIN`.

Không commit danh sách email thật nếu repo public.

## Deploy Web App

Tạo deployment mới kiểu **Web app** hoặc cập nhật deployment hiện có bằng **New version**.

Yêu cầu bảo mật:

- **Execute as:** user accessing the web app.
- **Who has access:** chỉ nhóm/tổ chức Google Workspace cần dùng hệ thống; không mở public anonymous.
- URL sử dụng phải là URL production deployment kết thúc bằng `/exec`, không dùng `/dev`.

Lý do: RBAC server-side dùng `Session.getActiveUser().getEmail()`. Nếu Apps Script không được phép biết active user, request sẽ fail đóng với `AUTHENTICATION_REQUIRED` thay vì dùng identity giả từ browser.

Bridge HTML dùng `XFrameOptionsMode.ALLOWALL` để có thể nhúng từ frontend ngoài Apps Script. Vì vậy clickjacking protection được thực thi bằng origin allowlist: `Bridge.html` chỉ chấp nhận `postMessage` khi `event.origin` có trong `ALLOWED_PARENT_ORIGINS_JSON`.

## Frontend configuration

Deployment URL thật được đăng ký trong config và có thể override bằng:

```text
VITE_APPS_SCRIPT_WEB_APP_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
```

Frontend chỉ chấp nhận HTTPS URL trên `script.google.com` kết thúc bằng `/exec`.

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

Nếu `authenticated=false`, không bật live persistence.

### 2. HTML bridge read

Mở frontend smoke page:

```text
/apps-script-smoke.html
```

Trang này tải:

```text
<WEB_APP_URL>?action=bridge
```

trong iframe, nhận `ready` bằng `postMessage`, rồi gọi `health` và `readTable(Equipment_Master)` qua `google.script.run`.

Kỳ vọng cuối:

- `phase = bridge-readTable`
- `health.authenticated = true`
- `read.ok = true`
- `read.table = Equipment_Master`
- `rowCount = 19` với seed hiện tại

Nếu nhận `ROLE_NOT_CONFIGURED`, transport bridge đã hoạt động; chỉ còn cấu hình `RBAC_JSON` cho tài khoản đang dùng.

### 3. Unauthorized write

Dùng tài khoản role không đủ quyền để gọi write. Kỳ vọng `ROLE_NOT_ALLOWED` và không phát sinh row/audit.

### 4. Idempotency

Gửi cùng một `operationId` hai lần qua bridge. Kỳ vọng lần hai:

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
- [x] RBAC role map contract.
- [x] `LockService` critical section.
- [x] Durable idempotency lookup thông qua append-only `Audit_Log`.
- [x] Compensating rollback cho append/maintenance multi-step writes.
- [x] Apps Script Web App đã deploy và direct health xác nhận `authenticated=true`.
- [x] HTMLService bridge transport đã triển khai trong source.
- [ ] Copy `Bridge.html` + Code.gs mới vào Apps Script và deploy New version.
- [ ] Cấu hình `ALLOWED_PARENT_ORIGINS_JSON`.
- [ ] Cấu hình `RBAC_JSON` thật.
- [ ] HTML bridge read smoke test đạt từ frontend origin.
- [ ] End-to-end write/idempotency smoke test bằng fixture riêng.
- [ ] Nối UI live workflow với bridge response.
- [ ] Persist BM-05 thật trước RELEASE.
- [ ] Optimistic concurrency cho record update ngoài maintenance.
- [ ] Evidence upload qua Drive adapter.

Không merge PR vào `main` trước khi các gate live persistence bắt buộc được xác nhận.
