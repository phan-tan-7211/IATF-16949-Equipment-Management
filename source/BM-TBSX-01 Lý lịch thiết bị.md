---
tags:
  - IATF16949
  - bieu-mau
  - ly-lich-thiet-bi
doc-code: CEV-BM-TBSX-01
owner: Phòng Kỹ thuật
retention: 10 năm
paper-size: A4
status: Approved
drafter: Phan Tấn (Mr.TAN) — 개발기술 파트
reviewer: 이규민 (Lee Kyu Min) — 팀장 제조지원팀
approver: 박인규 (Pak In Kyu) — 법인장
---

# BM-TBSX-01 — Lý lịch thiết bị

> [!info] Thông tin biểu mẫu
>
> | Hạng mục | Nội dung |
> | --- | --- |
> | Mã hồ sơ | CEV-BM-TBSX-01 |
> | Tên tiếng Anh | Equipment History Record (설비 이력카드) |
> | Thuộc quy trình | [[QT-TBSX Quy trình quản lý thiết bị sản xuất]] |
> | Phòng quản lý | Phòng Kỹ thuật |
> | Thời gian lưu | 10 năm · hủy bằng xé/cắt |
> | Khổ giấy | A4 — in theo [[HD - In xuất PDF chuẩn A4 (CSS snippet)]] |

Về nhà: [[00 Mục lục - Hệ thống Quản lý Thiết bị]]

## Mục đích

Lưu trữ chi tiết thông tin về **từng thiết bị** trong suốt vòng đời: thông tin mua hàng, thông số kỹ thuật, lịch sử bảo trì, sửa chữa, thay thế linh kiện… Giúp chẩn đoán sự cố, đánh giá hiệu quả bảo trì và quyết định thay thế/thanh lý.

**Mỗi thiết bị lập một lý lịch riêng** trong thư mục `03 Hồ sơ thiết bị/` — xem [[Mẫu - Lý lịch thiết bị]] và ví dụ đã điền [[TB-0002 Băng chuyền sấy (CEV-BCS-0002)]].

## Cấu trúc lý lịch (theo biểu mẫu gốc)

### Phần 1 — Thông tin cơ bản

| Nhóm | Trường thông tin |
| --- | --- |
| Nhận dạng | Tên thiết bị · Mã sản phẩm/số seri · Nhà sản xuất · Nơi sản xuất |
| Thông số kỹ thuật | Loại thiết bị · Kích thước · Trọng lượng · Công suất · Hiệu năng |
| Chức năng & ứng dụng | Mô tả chức năng chính · Lĩnh vực/ứng dụng sử dụng |
| Nguồn gốc & lịch sử | Ngày sản xuất · Ngày mua/sử dụng · Giá mua · Nơi mua · Vị trí lắp đặt |
| Bảo hành | Thời gian bảo hành · Liên hệ dịch vụ A/S |

### Phần 2 — Thiết bị quan trọng liên quan (부속기기)

| No | Tên thiết bị | Serial No | Loại | Maker | Ngày sản xuất | Remarks |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | |

### Phần 3 — Lý lịch vận hành đi kèm (설비 운영이력)

| Ngày | Nội dung quan trọng đi kèm | Phí | Thực hiện | Remarks |
| --- | --- | --- | --- | --- |
| | | | | |

## Dữ liệu mẫu từ file gốc

- Tên thiết bị: **Băng chuyền sấy** — mã `CEV-BCS-0002`
- Nhà sản xuất: Core Electronics (Việt Nam) · Nơi sản xuất: Nội bộ
- Loại: băng chuyền sấy · Kích thước: 3,0 m · Công suất: 6 kW
- Chức năng: sấy nhiệt · Ứng dụng: sản xuất linh kiện điện tử
- Ngày sản xuất: 30/07/2024 · Ngày đưa vào sử dụng: 30/08/2024 · Vị trí: coil · A/S: nội bộ

## Quy trình sử dụng

1. **Lập lần đầu:** tạo khi thiết bị được đưa vào sử dụng; nhập thông tin cơ bản + thông số kỹ thuật (lấy từ [[BM-TBSX-02 Danh mục quản lý thiết bị sản xuất]]).
2. **Cập nhật liên tục:** sau mỗi lần bảo dưỡng, sửa chữa, nâng cấp, kiểm định — phiếu bảo dưỡng/biên bản sửa chữa là đầu vào.
3. **Tra cứu:** khi có sự cố, lập kế hoạch bảo dưỡng lớn, hoặc đánh giá tình trạng để quyết định thay thế/thanh lý.
4. **Lưu trữ:** bản cứng và bản mềm, lưu cẩn thận theo mã thiết bị.
