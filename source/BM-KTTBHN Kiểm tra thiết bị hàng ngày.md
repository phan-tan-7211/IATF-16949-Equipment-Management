---
tags:
  - IATF16949
  - bieu-mau
  - kiem-tra-hang-ngay
doc-code: CEV-BM-KTTBHN
owner: Phòng Bảo trì
retention: ≥ 1 tháng/lần lưu hồ sơ
paper-size: A4
status: Approved
drafter: Phan Tấn (Mr.TAN) — 개발기술 파트
reviewer: 이규민 (Lee Kyu Min) — 팀장 제조지원팀
approver: 박인규 (Pak In Kyu) — 법인장
---

# BM-KTTBHN — Biểu mẫu kiểm tra thiết bị hàng ngày

> [!info] Thông tin biểu mẫu
>
> | Hạng mục | Nội dung |
> | --- | --- |
> | Mã hồ sơ | CEV-BM-KTTBHN |
> | Tên tiếng Anh | Daily Equipment Inspection Checklist |
> | Thuộc quy trình | [[QT-TBSX Quy trình quản lý thiết bị sản xuất]] |
> | Phòng quản lý | Bộ phận kỹ thuật (Mr.TAN phát hành) — **tổ trưởng các line giữ và tự kiểm tra** |
> | Nguyên tắc | Kiểm tra **trước khi sử dụng**; hồ sơ lưu tối thiểu mỗi tháng một lần |
> | Khổ giấy | A4 — in theo [[HD - In xuất PDF chuẩn A4 (CSS snippet)]] |

Về nhà: [[00 Mục lục - Hệ thống Quản lý Thiết bị]]

## Mục đích

Người vận hành/bảo trì viên tại chỗ kiểm tra nhanh các bộ phận quan trọng **đầu ca/cuối ca** để phát hiện sớm dấu hiệu bất thường nhỏ, ngăn ngừa hư hỏng lớn.

## Quy ước đánh dấu

| Ký hiệu | Ý nghĩa |
| --- | --- |
| V | Tốt |
| ○ | Sửa khẩn cấp |
| △ | Yêu cầu bảo trì |
| X | Hư hỏng — ngừng để sửa chữa |

## Phần đầu biểu mẫu

`Mã số · Tên máy · Khu vực làm việc · Ca làm việc (☐ Sáng ☐ Chiều ☐ Đêm) · Tháng/Năm · Người kiểm tra`

Cột ngày 1→31 để đánh dấu từng ngày trong tháng.

## Checklist mẫu (từ file gốc — máy ép terminal)

### I. An toàn (Safety)

1. Dây nguồn và phích cắm không bị hư hỏng, hở mạch điện.
2. Khóa liên động: nhấn 1 nút khởi động máy không hoạt động; nhấn 2 nút đồng thời máy mới hoạt động.
3. Khu vực làm việc xung quanh máy sạch sẽ, không vật liệu thừa.
4. Trang bị bảo hộ cá nhân (găng tay) có sẵn, tình trạng tốt.

### II. Chức năng (Function)

1. Máy khởi động và tắt êm.
2. Xi lanh di chuyển trơn tru, không kẹt.
3. Áp lực ép terminal ổn định, đúng yêu cầu.
4. Bộ hẹn giờ (timer) chính xác, thời gian ép đúng cài đặt.
5. Cơ cấu cấp terminal ổn định, không kẹt/hỏng terminal, bobin.
6. Máy hoạt động ổn định, không tiếng động lạ.
7. Kết nối điện không lỏng lẻo.
8. Solenoid điều khiển xi lanh hoạt động tốt.

### III. Bảo trì phòng ngừa (Daily checks)

1. Vệ sinh bên ngoài máy, loại bỏ bụi bẩn và mảnh vụn terminal.
2. Kiểm tra dây nguồn và phích cắm.
3. Kiểm tra các bộ phận chuyển động (bôi trơn nếu cần).
4. Kiểm tra xi lanh và đường ống khí nén.
5. Kiểm tra các nút nhấn khởi động.
6. Kiểm tra timer.
7. Kiểm tra relay.

### IV. Các hạng mục khác

1. Ghi chép đầy đủ quá trình sử dụng máy (loại terminal, số lượng, thông số cài đặt).
2. *(Thêm hạng mục đặc thù nếu cần — điều chỉnh checklist theo từng loại máy.)*

## Cuối biểu mẫu

- **Người kiểm tra/vận hành trực tiếp ký tên.**
- **Ghi chú/Hành động giải quyết** — mô tả bất thường và cách xử lý.
- **Linh kiện hư hỏng cần thay thế** — danh sách để đặt mua.

## Luân chuyển biểu mẫu trong thực tế

1. **Phát hành:** bộ phận kỹ thuật (**Mr.TAN**) in biểu mẫu theo kỳ và bàn giao cho **các tổ trưởng line**: 제조1 Breaker · 제조2 Coil Assy · 제조3 Solder/WPC · 제조4 Auto Line · 가공 Press/Coating.
2. **Tự kiểm tra:** tổ trưởng giữ biểu mẫu tại line và **tự đánh dấu kiểm tra hàng ngày** (đầu ca/cuối ca) theo checklist.
3. **Báo cáo bất thường:** phát hiện △ hoặc X → báo **ngay** cho Mr.TAN/bộ phận kỹ thuật; trường hợp X phải ngừng máy sửa chữa (theo bước 3.1 của [[QT-TBSX Quy trình quản lý thiết bị sản xuất]]).
4. **Thu hồi & lưu trữ:** cuối kỳ thu biểu mẫu về, lưu tối thiểu 1 tháng; mục *"Linh kiện hư hỏng cần thay thế"* được tổng hợp làm cơ sở đề xuất mua/sửa chữa.
