---
tags:
  - IATF16949
  - bieu-mau
  - downtime
  - mtbf-mttr
doc-code: CEV-BM-TBSX-06
owner: Phòng Bảo trì
retention: 10 năm
paper-size: A4
status: Approved
drafter: Phan Tấn (Mr.TAN) — 개발기술 파트
reviewer: 이규민 (Lee Kyu Min) — 팀장 제조지원팀
approver: 박인규 (Pak In Kyu) — 법인장
---

# BM-TBSX-06 — Bảng theo dõi chỉ số dừng máy

> [!info] Thông tin biểu mẫu
>
> | Hạng mục | Nội dung |
> | --- | --- |
> | Mã hồ sơ | CEV-BM-TBSX-06 |
> | Tên tiếng Anh | Machine Downtime Tracking Sheet |
> | Thuộc quy trình | [[QT-TBSX Quy trình quản lý thiết bị sản xuất]] |
> | Phòng quản lý | Phòng Bảo trì |
> | Thời gian lưu | 10 năm · hủy bằng xé/cắt |
> | Khổ giấy | A4 — in theo [[HD - In xuất PDF chuẩn A4 (CSS snippet)]] |

Về nhà: [[00 Mục lục - Hệ thống Quản lý Thiết bị]]

## Mục đích

Ghi nhận, phân loại và phân tích thời gian + nguyên nhân thiết bị ngừng hoạt động **ngoài kế hoạch**, nhằm xác định vấn đề gây tổn thất sản xuất và đưa ra giải pháp cải tiến. Là nguồn dữ liệu chính để tính **MTBF/MTTR** và KPI tỷ lệ dừng máy ([[KPI SOP3 Quản lý máy móc thiết bị sản xuất]]).

## Cấu trúc bảng (theo biểu mẫu gốc)

Phần đầu: `STT · Khu vực · Tên thiết bị · Mã thiết bị · Tổng thời gian dừng` + cột ngày 1→30 của tháng (đánh dấu V tại ngày dừng).

Phần tự động tính (cuối bảng):

| Chỉ tiêu | Công thức trong file gốc | Ý nghĩa |
| --- | --- | --- |
| Tổng thời gian máy chạy | `COUNT(số ngày ghi nhận) × 24 × 60` (phút) | Nền tảng tính MTBF |
| Tổng thời gian dừng máy | `SUM(các ô thời gian dừng)` | — |
| Số lần hỏng máy | đếm số lần đánh dấu | — |
| **MTBF** | `(Tổng tgian chạy − Tổng tgian dừng) / Số lần hỏng` | Mean Time Between Failure (phút) |
| **MTTR** | `Tổng tgian dừng / Số lần hỏng` | Mean Time To Repair (phút) |

Ví dụ dòng dữ liệu gốc: khu vực COIL, thiết bị WINDING, tổng dừng 2 giờ, đánh dấu ngày 4 và 7.

## Các trường cần có khi ghi nhận sự cố dừng máy

- Ngày dừng máy; thời điểm dừng (giờ:phút); thời điểm chạy lại (giờ:phút).
- Mã/tên thiết bị; bộ phận bị ảnh hưởng.
- **Nguyên nhân dừng máy — phân loại chuẩn hóa:** hỏng cơ khí · hỏng điện · chờ vật tư · bảo dưỡng đột xuất · set-up/thay khuôn · không có NV vận hành · thiếu nguyên liệu · lỗi quy trình…
- Mô tả chi tiết sự cố; hành động đã thực hiện để máy chạy lại.
- Người ghi nhận (vận hành/bảo trì); người xử lý; người báo cáo.

## Quy trình sử dụng

1. **Ghi nhận:** khi máy dừng ngoài kế hoạch, vận hành/giám sát ghi ngay thời gian + thiết bị; bảo trì đến xử lý ghi chi tiết nguyên nhân và hành động.
2. **Tổng hợp & phân tích:** hàng tuần/tháng; dùng biểu đồ Pareto tìm thiết bị dừng nhiều nhất, nguyên nhân phổ biến nhất.
3. **Cải tiến:** đề xuất hành động (tăng PM cho bộ phận hay hỏng, cải tiến quy trình vận hành, đào tạo…) → phản ánh vào [[BM-TBSX-03 Kế hoạch bảo dưỡng máy]] và [[BM-TBSX-07 Phiếu bảo dưỡng dự báo]].
