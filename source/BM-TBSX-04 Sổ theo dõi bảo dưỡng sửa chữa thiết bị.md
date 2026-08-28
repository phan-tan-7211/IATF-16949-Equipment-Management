---
tags:
  - IATF16949
  - bieu-mau
  - so-theo-doi-bao-duong
doc-code: CEV-BM-TBSX-04
owner: Phòng Bảo trì
retention: 10 năm
paper-size: A4
status: Approved
drafter: Phan Tấn (Mr.TAN) — 개발기술 파트
reviewer: 이규민 (Lee Kyu Min) — 팀장 제조지원팀
approver: 박인규 (Pak In Kyu) — 법인장
---

# BM-TBSX-04 — Sổ theo dõi bảo dưỡng, sửa chữa thiết bị

> [!info] Thông tin biểu mẫu
>
> | Hạng mục | Nội dung |
> | --- | --- |
> | Mã hồ sơ | CEV-BM-TBSX-04 |
> | Tên tiếng Anh | Maintenance and Repair Logbook |
> | Thuộc quy trình | [[QT-TBSX Quy trình quản lý thiết bị sản xuất]] |
> | Phòng quản lý | Phòng Bảo trì |
> | Thời gian lưu | 10 năm · hủy bằng xé/cắt |
> | Khổ giấy | A4 — in theo [[HD - In xuất PDF chuẩn A4 (CSS snippet)]] |

Về nhà: [[00 Mục lục - Hệ thống Quản lý Thiết bị]]

## Mục đích

Ghi nhận **tất cả** hoạt động bảo dưỡng (định kỳ, dự phòng, dự báo) và sửa chữa đã diễn ra — như một cuốn nhật ký chung của hoạt động bảo trì. Là nguồn dữ liệu đầu vào để cập nhật [[BM-TBSX-01 Lý lịch thiết bị]] và tính KPI MTBF/MTTR.

## Cấu trúc sổ

| STT | Ngày tháng năm | Tên thiết bị | Mã số quản lý thiết bị | Vị trí xảy ra sự cố | Nội dung sự cố và nguyên nhân | Biện pháp giải quyết, khắc phục | Thời gian bắt đầu SC | Thời gian hoàn thành | Tổng thời gian sửa chữa | Ghi chú |
| --- | -------------- | ------------ | ---------------------- | ------------------- | ----------------------------- | ------------------------------- | -------------------- | -------------------- | ----------------------- | ------- |
| 1   |                |              |                        |                     |                               |                                 |                      |                      |                         |         |
| 2   |                |              |                        |                     |                               |                                 |                      |                      |                         |         |

*(Sổ gốc bố trí 20 dòng/trang, khổ A4.)*

## Dữ liệu mẫu từ file gốc

| STT | Ngày       | Tên thiết bị | Mã TB     | Nội dung/loại công việc       | Người thực hiện | Vật tư sử dụng        | Chi phí     |
| --- | ---------- | ------------ | --------- | ----------------------------- | --------------- | --------------------- | ----------- |
| 1   | 15/05/2024 | Máy phay CNC | CNC-001   | Sửa chữa — thay bộ điều khiển | Lê Thị C        | Bộ điều khiển XYZ-500 | 5.000.000 ₫ |
| 2   | 01/2024    | Máy tiện     | LATHE-002 | Bảo dưỡng định kỳ             | Trần Văn B      | Dầu nhớt, lọc dầu     | 1.000.000 ₫ |

## Quy tắc ghi chép

- Ghi **ngay sau khi hoàn thành** bất kỳ công việc bảo dưỡng hay sửa chữa nào.
- Ghi đầy đủ thời gian bắt đầu/kết thúc để tính được **tổng thời gian sửa chữa** (dùng cho MTTR) và khoảng cách giữa các lần hỏng (dùng cho MTBF — xem [[KPI SOP3 Quản lý máy móc thiết bị sản xuất]]).
- Loại công việc phân biệt rõ: bảo dưỡng định kỳ · bảo dưỡng dự phòng · bảo dưỡng dự báo · sửa chữa đột xuất · cải tiến · kiểm tra.
- Tham chiếu số phiếu ([[BM-TBSX-07 Phiếu bảo dưỡng dự báo]]) nếu công việc phát sinh từ phiếu.

## Quy trình sử dụng

1. **Ghi chép:** kỹ thuật viên ghi vào sổ ngay khi hoàn thành công việc.
2. **Quản lý:** sổ được quản lý tập trung tại phòng bảo trì.
3. **Sử dụng:** tra cứu lịch sử gần đây, tổng hợp báo cáo tuần/tháng, cập nhật lý lịch thiết bị, phân tích nguyên nhân sự cố khi lập kế hoạch bảo dưỡng.
