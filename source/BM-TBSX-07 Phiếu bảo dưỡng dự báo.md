---
tags:
  - IATF16949
  - bieu-mau
  - bao-duong-du-bao
doc-code: CEV-BM-TBSX-07
owner: Phòng Kỹ thuật
retention: 10 năm
paper-size: A4
status: Approved
drafter: Phan Tấn (Mr.TAN) — 개발기술 파트
reviewer: 이규민 (Lee Kyu Min) — 팀장 제조지원팀
approver: 박인규 (Pak In Kyu) — 법인장
---

# BM-TBSX-07 — Phiếu bảo dưỡng dự báo

> [!info] Thông tin biểu mẫu
>
> | Hạng mục | Nội dung |
> | --- | --- |
> | Mã hồ sơ | CEV-BM-TBSX-07 |
> | Tên tiếng Anh | Predictive/Preventive Maintenance Work Order |
> | Thuộc quy trình | [[QT-TBSX Quy trình quản lý thiết bị sản xuất]] |
> | Phòng quản lý | Phòng Kỹ thuật |
> | Thời gian lưu | 10 năm · hủy bằng xé/cắt |
> | Khổ giấy | A4 — in theo [[HD - In xuất PDF chuẩn A4 (CSS snippet)]] |

Về nhà: [[00 Mục lục - Hệ thống Quản lý Thiết bị]]

## Mục đích

Tài liệu hỗ trợ tập trung vào việc **dự báo các vấn đề tiềm ẩn** và đề xuất giải pháp bảo dưỡng **trước khi sự cố xảy ra** — dựa trên dữ liệu kỹ thuật, kết quả đo đạc (rung động, nhiệt độ, dầu…) hoặc số giờ hoạt động.

**Phân biệt với [[BM-TBSX-03 Kế hoạch bảo dưỡng máy]]:** kế hoạch là tài liệu chính thống, mang tính định hướng dài hạn cho toàn bộ hoạt động bảo dưỡng; phiếu dự báo là tài liệu bổ sung, giúp phát hiện rủi ro tiềm ẩn và điều chỉnh kế hoạch khi cần — tăng tính linh hoạt và khả năng ứng phó nhanh với sự cố không mong muốn.

## Cấu trúc phiếu (theo biểu mẫu gốc)

### Phần 1 — Đề xuất và ghi chép bảo dưỡng dự báo

| Trường | Nội dung |
| --- | --- |
| Khu vực · Mục đích | |
| Tên máy · Mã thiết bị | |
| Xác nhận đề xuất | ☐ Đồng ý tiến hành bảo dưỡng dự báo · ☐ Không đồng ý tiến hành bảo dưỡng dự báo |
| Phương pháp thực hiện | |
| Thời gian thực hiện | Từ …/…/… đến …/…/… |
| Người lập · Xác nhận · Phê duyệt | ký + ngày |

**Bảng theo dõi thông số:**

| STT | Hạng mục / Thông số theo dõi | Đơn vị | Kết quả kiểm tra (cột …/… cho từng lần đo) |
| --- | --- | --- | --- |
| 1 | | | |

Kèm theo: **Đồ thị theo dõi** (vẽ xu hướng thông số qua các lần đo) · Người thực hiện · Leader ME xác nhận · Đề xuất cho vấn đề phát sinh.

### Phần 2 — Kết quả bảo dưỡng

- ☐ Tiếp tục thực hiện bảo dưỡng dự báo
- ☐ Cải tiến chương trình bảo dưỡng hiện tại
- ☐ Dừng thực hiện bảo dưỡng dự báo / Đề xuất khác: …

## Mở rộng dạng Work Order (theo phần mô tả trong file gốc)

Khi dùng như lệnh công việc: Số phiếu · Ngày lập · Người lập · Thông tin thiết bị (mã/tên/bộ phận) · Lý do yêu cầu BD dự báo · Mức độ ưu tiên (Cao/TB/Thấp) · Người phê duyệt + ngày · Checklist công việc chi tiết (Kiểm tra/Vệ sinh/Bôi trơn/Siết chặt/Đo đạc/Thay thế) với cột *Kết quả/Thông số đo được* và cột *Đạt/Không đạt/Ghi chú* · Vật tư/phụ tùng dự kiến và thực tế sử dụng · Thời gian thực hiện · Phát hiện bất thường/Đề xuất · Xác nhận người thực hiện + giám sát.

## Quy trình sử dụng

1. **Lập phiếu:** bộ phận kế hoạch bảo trì dựa vào [[BM-TBSX-03 Kế hoạch bảo dưỡng máy]] hoặc kết quả giám sát tình trạng để tạo phiếu, giao kỹ thuật viên.
2. **Phê duyệt:** phiếu gửi người phê duyệt xem xét, chấp thuận.
3. **Thực hiện:** kỹ thuật viên nhận phiếu, chuẩn bị dụng cụ/vật tư, thực hiện theo checklist, ghi kết quả/thông số/vật tư và phát hiện bất thường.
4. **Báo cáo & đóng phiếu:** hoàn thành → ký xác nhận → nộp lại cho giám sát/quản lý xem xét, phê duyệt.
5. **Cập nhật hồ sơ:** thông tin cập nhật vào [[BM-TBSX-01 Lý lịch thiết bị]] và [[BM-TBSX-04 Sổ theo dõi bảo dưỡng sửa chữa thiết bị]]; các đề xuất bất thường có thể tạo yêu cầu sửa chữa mới.
