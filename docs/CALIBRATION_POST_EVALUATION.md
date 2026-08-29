# Đánh giá sau hiệu chuẩn

## Quy tắc bắt buộc

Luồng hiệu chuẩn không kết thúc ngay sau khi ghi `Calibration_Log`.

Luồng đúng:

```text
Thiết bị MEASUREMENT đã liên kết Calibration_Master
→ Thực hiện hiệu chuẩn
→ Ghi Calibration_Log + chứng nhận + ảnh tem
→ Trạng thái nghiệp vụ: CHỜ ĐÁNH GIÁ
→ Đánh giá sau hiệu chuẩn
→ ĐẠT / HẠN CHẾ SỬ DỤNG / KHÔNG ĐẠT
→ Hoàn tất hồ sơ hiệu chuẩn
```

## Cách lưu dữ liệu

Contract G1 hiện giữ 20 bảng, vì vậy không tạo bảng thứ 21 chỉ cho bước đánh giá.

- `Calibration_Log`: lưu chứng từ/lần hiệu chuẩn gốc.
- `Audit_Log`: lưu sự kiện `EVALUATE_CALIBRATION:<operationId>` gắn với `calibrationId`.
- Một `calibrationId` chỉ được đánh giá một lần trong workflow hiện tại.
- Kết quả đánh giá dùng đúng ba mức đã có của nghiệp vụ hiệu chuẩn: `PASS`, `LIMITED_USE`, `FAIL`.
- Với `LIMITED_USE` hoặc `FAIL`, nhận xét đánh giá là bắt buộc.
- Người đánh giá và thời điểm đánh giá do Apps Script xác lập server-side.
- Quyền đánh giá: `QUALITY`, `MANAGER`, `ADMIN`.

## Quy tắc UI

Màn Hiệu chuẩn phải hiển thị riêng các hồ sơ `Calibration_Log` chưa có sự kiện `EVALUATE_CALIBRATION` là **Chờ đánh giá**.

Người dùng chỉ có thể hoàn tất bước đánh giá sau khi một lần hiệu chuẩn đã tồn tại. Không cho phép đánh giá trước khi tạo `Calibration_Log`.

## Audit

Sự kiện đánh giá phải ghi:

- `entityType = CALIBRATION`;
- `entityId = calibrationId`;
- kết quả hiệu chuẩn gốc;
- kết quả đánh giá;
- nhận xét đánh giá;
- người đánh giá;
- thời điểm đánh giá.
