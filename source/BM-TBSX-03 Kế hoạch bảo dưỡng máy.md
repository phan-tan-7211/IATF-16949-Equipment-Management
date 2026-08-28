---
tags:
  - IATF16949
  - bieu-mau
  - ke-hoach-bao-duong
doc-code: CEV-BM-TBSX-03
owner: Phòng Bảo trì
retention: 10 năm
paper-size: A4
status: Approved
drafter: Phan Tấn (Mr.TAN) — 개발기술 파트
reviewer: 이규민 (Lee Kyu Min) — 팀장 제조지원팀
approver: 박인규 (Pak In Kyu) — 법인장
---

# BM-TBSX-03 — Kế hoạch bảo dưỡng máy

> [!info] Thông tin biểu mẫu
>
> | Hạng mục | Nội dung |
> | --- | --- |
> | Mã hồ sơ | CEV-BM-TBSX-03 |
> | Tên tiếng Anh | Machine Maintenance Plan |
> | Thuộc quy trình | [[QT-TBSX Quy trình quản lý thiết bị sản xuất]] |
> | Phòng quản lý | Phòng Bảo trì |
> | Thời gian lưu | 10 năm · hủy bằng xé/cắt |
> | Khổ giấy | A4 — in theo [[HD - In xuất PDF chuẩn A4 (CSS snippet)]] |

Về nhà: [[00 Mục lục - Hệ thống Quản lý Thiết bị]]

## Mục đích

Hoạch định các hoạt động **bảo dưỡng định kỳ (Preventive Maintenance)** cho từng thiết bị/nhóm thiết bị trong một kỳ (năm/quý/tháng). Là tài liệu nền tảng — mọi thiết bị trong [[BM-TBSX-02 Danh mục quản lý thiết bị sản xuất]] đều phải có kế hoạch này.

## Cấu trúc bảng kế hoạch (theo biểu mẫu gốc)

Phần đầu bảng: `Stt · Tên thiết bị · Mã thiết bị · Loại bảo dưỡng · Tần suất · Thời gian dự kiến · Người thực hiện · Ghi chú`

Phần hạng mục chi tiết theo từng thiết bị:

| Hạng mục / Item | Tiêu chuẩn / Standard | Phương pháp / Method | Ghi nhận theo ngày trong năm (1–12 tháng × 31 ngày) |
| --- | --- | --- | --- |
| | | | ☐ đánh dấu ngày thực hiện |

## Ví dụ từ file gốc (kế hoạch năm 2024)

**Thiết bị 1 — Máy phay CNC (CNC-001):**

| Loại BD | Tần suất | Thời gian dự kiến | Người thực hiện | Nội dung |
| --- | --- | --- | --- | --- |
| Hàng tháng | 1 tháng/lần | Thứ 7 tuần 2 | Trần Văn B | Kiểm tra dầu nhớt, hệ thống làm mát |
| Định kỳ | 3 tháng/lần | Tháng 3, 6, 9, 12 | Lê Thị C | Kiểm tra độ chính xác, thay dầu |

Hạng mục chi tiết: **MOTOR** — tiêu chuẩn *bị bẩn, bị mòn và bị hỏng* → kiểm tra và vệ sinh.

**Thiết bị 2 — Máy tiện (LATHE-002):**

| Loại BD | Tần suất | Thời gian dự kiến | Người thực hiện | Nội dung |
| --- | --- | --- | --- | --- |
| Hàng quý | 3 tháng/lần | Tháng 3, 6, 9, 12 | Lê Thị C | Kiểm tra độ chính xác, thay dầu |

Hạng mục chi tiết: **DÂY CUROA** — tiêu chuẩn *bị mòn, bị đứt* → kiểm tra.

**Thiết bị 3 — Máy cuộn dây hình xuyến (T200H)** — định kỳ 3 tháng, người thực hiện: nhân viên bảo trì:

| Hạng mục | Tiêu chuẩn | Phương pháp |
| --- | --- | --- |
| Kiểm tra hệ thống điện | Bị cong, bị gỉ | Vệ sinh và kiểm tra |
| Kiểm tra hệ thống điều khiển | Hoạt động bình thường | Vệ sinh và kiểm tra |
| Kiểm tra cơ cấu truyền động | Hoạt động bình thường | Vệ sinh và kiểm tra |
| Bôi trơn các bộ phận chuyển động | — | Bôi trơn |
| Kiểm tra hệ thống căng dây | Căng đều | Kiểm tra, điều chỉnh |
| Kiểm tra độ chính xác của đầu quấn và dẫn dây | — | Kiểm tra |
| Kiểm tra hệ thống an toàn | Hoạt động tốt | Kiểm tra |
| Vệ sinh tổng thể | Sạch | Vệ sinh |
| Kiểm tra và siết chặt các ốc vít, bulong | Không lỏng | Siết chặt |
| Đánh giá tình trạng các bộ phận hao mòn | Trong giới hạn | Đánh giá |
| RING SHUTTLE slider | Bị cong, bị gỉ | Vệ sinh và kiểm tra |
| Tủ điện của máy | Bị bẩn, có nguồn lạ | Vệ sinh và kiểm tra *(Check and clean)* |
| Động cơ chính (Main motor) | Dây đai bị trùng, động cơ bị bẩn | Vệ sinh và kiểm tra |
| Bản điều khiển | Có hoạt động hay không | Kiểm tra và thay thế |
| Trục giữ core | Thùng dầu bị bẩn *(tank was dusty)* | Vệ sinh và kiểm tra |
| Clamp/Knock out — Dây dầu kẹp khuôn | Không bị xước, bị bục | Kiểm tra và thay thế |
| Clamp/Knock out — Xy lanh kẹp khuôn | Kẹp chậm, bị kẹt | Kiểm tra và thay thế |
| Clamp/Knock out — Pump kẹp khuôn | Không bị bẩn, không bị kêu | Kiểm tra và vệ sinh |
| Clamp/Knock out — Knock out (KO) | Không bẩn, lên xuống đều | Kiểm tra và vệ sinh |

## Mẫu kế hoạch bảo dưỡng mở rộng theo IATF 16949 (12 mục)

File gốc kèm sẵn khung kế hoạch chi tiết gồm:

1. **Thông tin chung** — tên công ty, địa chỉ, bộ phận, ngày/người lập, ngày/người phê duyệt.
2. **Thông tin máy** — tên, mã, vị trí, nhà sản xuất, năm SX, ngày mua, giá trị, tài liệu kỹ thuật liên quan.
3. **Mục tiêu bảo dưỡng** — duy trì hiệu suất, kéo dài tuổi thọ, đảm bảo an toàn.
4. **Phạm vi bảo dưỡng** — liệt kê bộ phận/hệ thống cần bảo dưỡng.
5. **Loại hình bảo dưỡng** — PM (kiểm tra, vệ sinh, bôi trơn, thay bộ phận hao mòn, điều chỉnh) · CM (chẩn đoán, thay bộ phận hỏng, sửa chữa) · PdM (phân tích rung động/nhiệt độ/dầu, giám sát hiệu suất).
6. **Tần suất bảo dưỡng** — hàng ngày/tuần/tháng/quý/năm.
7. **Chi tiết công việc** — bảng: STT · Công việc · Mô tả chi tiết · Dụng cụ/thiết bị cần thiết · Thời gian thực hiện · Người thực hiện · Tần suất · Ghi chú.
8. **Vật tư, phụ tùng thay thế** — bảng: STT · Tên vật tư/phụ tùng · Mã số · Đơn vị tính · Số lượng · Nhà cung cấp · Ghi chú.
9. **An toàn** — thiết bị bảo hộ cá nhân, ngắt nguồn điện…
10. **Kiểm tra và nghiệm thu** — quy trình, tiêu chí nghiệm thu, hồ sơ nghiệm thu.
11. **Đánh giá và cải tiến** — đánh giá định kỳ hiệu quả, đề xuất cải tiến.
12. **Phê duyệt** — chữ ký người lập/người duyệt, ngày duyệt.

> [!note] Lưu ý trong file gốc
> Biểu mẫu có thể điều chỉnh theo đặc thù từng loại máy; cần quy trình/hướng dẫn chi tiết đi kèm; hồ sơ lưu trữ đầy đủ, có hệ thống; tuân thủ IATF 16949 điều **8.5.1.5** (bảo trì năng suất), **8.5.1.6** (quản lý công cụ sản xuất), **8.5.1.7** (bảo dưỡng phòng ngừa).

## Quy trình sử dụng

1. **Lập kế hoạch:** dựa trên khuyến cáo nhà sản xuất, kinh nghiệm vận hành, lịch sử hư hỏng (từ [[BM-TBSX-01 Lý lịch thiết bị]]) và yêu cầu sản xuất — lập vào cuối năm trước/đầu kỳ; trình quản lý phê duyệt.
2. **Triển khai:** làm cơ sở phát sinh công việc bảo dưỡng; kết quả ghi vào [[BM-TBSX-04 Sổ theo dõi bảo dưỡng sửa chữa thiết bị]]; công việc dự báo bổ sung từ [[BM-TBSX-07 Phiếu bảo dưỡng dự báo]].
3. **Theo dõi & điều chỉnh:** cập nhật trạng thái so với kế hoạch; điều chỉnh khi lịch sản xuất/thiết bị thay đổi.
4. **Đánh giá cuối kỳ:** hiệu quả dựa trên chi phí, thời gian dừng máy, số lần hỏng đột xuất → đầu vào [[KPI SOP3 Quản lý máy móc thiết bị sản xuất]].

## Phân loại bảo dưỡng (tham khảo khung IATF trong file gốc)

- **PM — Bảo dưỡng phòng ngừa:** định kỳ theo thời gian/giờ hoạt động: kiểm tra, vệ sinh, bôi trơn, thay bộ phận hao mòn, điều chỉnh.
- **CM — Bảo dưỡng khắc phục:** chẩn đoán nguyên nhân, thay bộ phận hỏng, sửa chữa khi gặp sự cố.
- **PdM — Bảo dưỡng dự đoán:** phân tích rung động, nhiệt độ, dầu; giám sát hiệu suất để dự đoán thời điểm hỏng.
