# Triển khai Apps Script Web App

## Mục tiêu

Apps Script là ranh giới persistence/workflow duy nhất cho Google Sheets/Drive. UI production chạy trực tiếp bằng **Apps Script HTMLService** và gọi server bằng `google.script.run`.

Frontend không giữ Google credential và không gọi trực tiếp Sheets/Drive API.

Production browser path:

```text
AppShell HTMLService
→ google.script.run
→ Apps Script server functions
→ Google Sheets / Drive
```

## Project source phải đồng bộ

Khi cập nhật deployment, phải đồng bộ **toàn bộ thư mục `apps-script/`**, không chỉ `Code.gs` và `AppShell.html`.

Các module nghiệp vụ hiện có gồm:

- `Code.gs`
- `Session.gs`
- `Equipment.gs`
- `Inspection.gs`
- `Maintenance.gs`
- `Handover.gs`
- `Calibration.gs`
- `CalibrationLink.gs`
- `CalibrationEvaluation.gs`
- `Tooling.gs`
- `KpiLive.gs`
- `DriveEvidence.gs`
- `Fixture.gs`
- `AppShell.html`
- `AppShellBody.html`
- `AppShellStyle.html`
- `AppShellClient.html`
- `KpiPanel.html`
- `KpiClient.html`
- `ToolingPanel.html`
- `ToolingClient.html`
- `CalibrationAdminPanel.html`
- `CalibrationAdminClient.html`
- `CalibrationEntryPanel.html`
- `CalibrationEntryClient.html`
- `CalibrationEvaluationPanel.html`
- `CalibrationEvaluationClient.html`
- `Bridge.html` — diagnostic/legacy, không phải production path
- `appsscript.json`

Canonical storage:

- Spreadsheet ID: `1zvrMyGDnXy3HMRzFrLYS4IFyuYPsSUTROy22M6Le9VE`
- Fixture Spreadsheet ID: `1_Qy8OGZ4nSxzi9I1kctC6XMABvBoYtVLDYurf3jZyJo`
- Project folder ID: `1hxow8p4gir4KRJZUMhEntsrazjAqfVGI`
- Contract: `G1-frozen-2026-08-28`

## Drive evidence — đã xác minh thực tế ngày 2026-08-29

Đã list trực tiếp project folder và xác nhận đúng 9 thư mục sau:

1. `equipment-photos`
2. `manuals-and-setup`
3. `maintenance-before-after`
4. `calibration-certificates`
5. `calibration-label-photos`
6. `tooling-drawings`
7. `tooling-change-attachments`
8. `handover-records`
9. `official-pdf-snapshots`

Tên thư mục khớp 9/9 với `EVIDENCE_FOLDERS` và `DriveEvidence.gs`.

Không tạo thêm thư mục tự động khi upload. Nếu thư mục bị đổi tên/mất/nhân đôi, adapter phải fail đóng.

## Bắt buộc trước khi deploy

1. Mở standalone Apps Script project production hiện có.
2. Đồng bộ toàn bộ source trong `apps-script/`.
3. Kiểm tra **Project Settings → Script properties**:
   - `RBAC_JSON`
   - `TEST_SPREADSHEET_ID = 1_Qy8OGZ4nSxzi9I1kctC6XMABvBoYtVLDYurf3jZyJo`
4. `TEST_SPREADSHEET_ID` tuyệt đối không được bằng canonical production Spreadsheet ID.
5. Role hợp lệ:
   - `OPERATOR`
   - `MAINTENANCE`
   - `SUPERVISOR`
   - `QUALITY`
   - `MANAGER`
   - `ADMIN`
6. Không commit email thực vào repo public.

## OAuth Drive

Manifest hiện có Drive scope để Evidence adapter hoạt động.

Sau khi deploy version chứa Drive scope, tài khoản sử dụng có thể được Google yêu cầu **ủy quyền lại**.

Không bỏ qua bước này và không kết luận Evidence lỗi nếu deployment chưa được reauthorize.

## Deploy Web App

Tạo version mới hoặc cập nhật deployment hiện có:

- **Execute as:** user accessing the web app.
- **Who has access:** chỉ nhóm/tổ chức Google Workspace cần dùng.
- Không mở anonymous public.
- Production dùng `/exec`, không dùng `/dev`.

Sau mỗi thay đổi source:

```text
Save
→ Manage deployments
→ Edit
→ New version
→ Deploy
```

Save trong editor không tự cập nhật snapshot `/exec` hiện tại.

## URL kiểm tra

### Health

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

### Production UI

```text
<WEB_APP_URL>?action=app
```

## Smoke test bắt buộc sau deploy

### 1. AppShell / Equipment

- HTMLService tải thành công, không lỗi include file.
- `Equipment_Master` đọc đúng dữ liệu production hiện hành.
- Admin form hiển thị đúng quyền.
- Không test create/update/delete bằng 19 row production.

### 2. Fixture idempotency

Chạy fixture bằng `TEST_SPREADSHEET_ID`.

Kỳ vọng:

- lần 1 ghi 1 row + 1 audit;
- lần 2 cùng `operationId` trả duplicate;
- không phát sinh row/audit lần hai.

### 3. Maintenance guard

Xác nhận:

- role không hợp lệ → `ROLE_NOT_ALLOWED`;
- requester tự approve → `SELF_APPROVAL_FORBIDDEN`;
- performer tự verify → `SELF_VERIFICATION_FORBIDDEN`.

### 4. Daily Inspection X

Trên test scope:

```text
X
→ Daily_Inspection
→ Maintenance_Work_Order
→ Downtime_Event
→ Audit_Log
```

Toàn bộ phải cùng `equipmentId` fixture và rollback khi một bước fail.

### 5. BM-05

```text
VERIFIED Work Order
→ tạo BM-05
→ đúng người nhận xác nhận
→ condition hợp lệ
→ RELEASE
```

`NOT_OPERABLE` phải khóa RELEASE.

### 6. Calibration

Trên thiết bị đo kiểm fixture:

```text
Equipment_Master (MEASUREMENT)
→ liên kết Calibration_Master
→ Calibration_Log
→ đánh giá sau hiệu chuẩn
```

Xác nhận:

- không được ghi hiệu chuẩn cho thiết bị không phải `MEASUREMENT`;
- link conflict bị chặn;
- đánh giá `LIMITED_USE` / `FAIL` bắt buộc nhận xét;
- một calibrationId chỉ có một đánh giá;
- Audit entity type dùng `CALIBRATION` đúng contract.

### 7. Tooling

Kiểm:

- BM-09 tạo tooling bằng mã chính thức;
- BM-10 Phần A tạo kế hoạch bám `toolingId`;
- BM-11 tạo hồ sơ thay đổi trước khi thực hiện;
- proposer không tự phê duyệt;
- QA confirmation chỉ dùng khi cần;
- chỉ hoàn tất sau approval và nhập `updatedDocuments`.

BM-10 Phần B chưa được coi là live đầy đủ vì G1 thiếu schema cấu trúc cho tồn kho tối thiểu / chu kỳ đặt mua / nơi đặt mua / người theo dõi.

### 8. KPI live

Theo tháng:

- bảo trì đúng hạn;
- tỷ lệ dừng máy;
- MTBF;
- MTTR.

Nếu không có `Daily_Inspection` đủ để làm nền runtime thì phải hiện **Chưa đủ dữ liệu**, không trả 0% giả.

### 9. Drive Evidence

Upload một file nhỏ vào test entity phù hợp và xác nhận:

- folderName nằm trong allowlist 9 thư mục đã xác minh;
- file được tạo trong đúng project child folder;
- Audit Log ghi `UPLOAD_EVIDENCE`;
- retry cùng operationId không tạo file thứ hai;
- audit fail → file rollback vào Trash;
- không thay đổi sharing state.

## Production gates

- [x] Apps Script-only boundary.
- [x] Frozen table allowlist 20 bảng.
- [x] Server-side identity + RBAC.
- [x] LockService + durable idempotency + compensating rollback.
- [x] Maintenance negative guards đã có source và fixture smoke.
- [x] BM-05 source-complete.
- [x] Equipment Admin source-complete + optimistic concurrency.
- [x] Calibration link/log/post-calibration evaluation source-complete.
- [x] Tooling BM-09/BM-10A/BM-11 source-complete.
- [x] KPI monthly live source-complete.
- [x] Drive Evidence source-complete.
- [x] 9/9 Drive evidence folders đã xác minh trực tiếp ngày 2026-08-29.
- [x] Quality Gate #290 PASS tại commit `e52c0edb2bfd799c5f064d1ee57f5c6a218ac223` trước cập nhật tài liệu deployment.
- [ ] Đồng bộ source mới vào Apps Script production project.
- [ ] Reauthorize Drive scope sau deployment nếu Google yêu cầu.
- [ ] Chạy smoke test fixture cho các module mới.
- [ ] Xác nhận AppShell HTMLService không regression.
- [ ] Thiết kế migration BM-10 Phần B nếu thuộc phạm vi release.
- [ ] Chỉ sau các gate trên mới merge PR.

**Không merge PR vào `main` ở trạng thái hiện tại.**
