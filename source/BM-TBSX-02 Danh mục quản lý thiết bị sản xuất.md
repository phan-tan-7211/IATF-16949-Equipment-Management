---
tags:
  - IATF16949
  - bieu-mau
  - danh-muc-thiet-bi
doc-code: CEV-BM-TBSX-02
owner: Phòng Kỹ thuật
retention: 10 năm
paper-size: A4
status: Approved
drafter: Phan Tấn (Mr.TAN) — 개발기술 파트
reviewer: 이규민 (Lee Kyu Min) — 팀장 제조지원팀
approver: 박인규 (Pak In Kyu) — 법인장
---

# BM-TBSX-02 — Danh mục quản lý thiết bị sản xuất

> [!info] Thông tin biểu mẫu
>
> | Hạng mục | Nội dung |
> | --- | --- |
> | Mã hồ sơ | CEV-BM-TBSX-02 |
> | Tên tiếng Anh | Equipment Management List |
> | Thuộc quy trình | [[QT-TBSX Quy trình quản lý thiết bị sản xuất]] |
> | Phòng quản lý | Phòng Kỹ thuật |
> | Thời gian lưu | 10 năm · hủy bằng xé/cắt |
> | Khổ giấy | A4 — in theo [[HD - In xuất PDF chuẩn A4 (CSS snippet)]] |

Về nhà: [[00 Mục lục - Hệ thống Quản lý Thiết bị]]

## Mục đích

- **Tầm nhìn tổng quan:** cái nhìn toàn cảnh mọi thiết bị sản xuất — tên, mã số, tình trạng, vị trí lắp đặt.
- **Nền tảng quản lý:** cơ sở lập kế hoạch bảo trì định kỳ, dự báo sự cố, quản lý vòng đời từ khi đưa vào sử dụng đến ngưng vận hành.
- **Đảm bảo tiêu chuẩn:** tuân thủ IATF 16949, đảm bảo ổn định và hiệu suất dây chuyền.

## Cấu trúc bảng danh mục

| STT | Mã thiết bị | Tên thiết bị | Loại thiết bị | Kiểu máy (Model) | Nhà SX/NCC | Năm SX | Ngày mua/đưa vào SD | Vị trí lắp đặt | Bộ phận quản lý/SD | Thông số KT chính | Chu kỳ BD | Tình trạng | Ngày cập nhật cuối | Giá trị ban đầu | Ghi chú | Tài liệu liên quan |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

**Ý nghĩa các cột chính:**

1. **STT** — sắp xếp dễ tìm kiếm.
2. **Mã thiết bị (ID/Code)** — định danh duy nhất, dùng liên kết dữ liệu giữa các biểu mẫu.
3. **Tên thiết bị** — nhận diện nhanh.
4. **Loại thiết bị** — phân loại theo chức năng (máy tiện, máy phay, die casting…).
5. **Model/Serial** — định danh từ nhà sản xuất.
6. **Nhà sản xuất/Nhà cung cấp**, **Năm sản xuất**, **Ngày mua** — nguồn gốc, mốc khấu hao/bảo trì.
7. **Vị trí lắp đặt**, **Bộ phận quản lý/sử dụng** — trách nhiệm chính.
8. **Thông số kỹ thuật chính** — công suất, kích thước, năng suất.
9. **Chu kỳ bảo dưỡng** — đồng bộ với [[BM-TBSX-03 Kế hoạch bảo dưỡng máy]].
10. **Tình trạng hiện tại** — đang hoạt động / bảo trì / thanh lý.
11. **Ngày cập nhật cuối**, **Giá trị ban đầu**, **Ghi chú**, **Tài liệu liên quan**.

## Dữ liệu đầy đủ chuyển từ file gốc (19 thiết bị)

> [!note]
> Đây là danh mục chính thức của nhà máy — cập nhật trực tiếp vào bảng khi có thay đổi thực tế.

| STT | Mã thiết bị | Tên thiết bị | Model | Nhà SX | Năm SX | Ngày đưa vào SD | Vị trí | Bộ phận | Chu kỳ BD | Tình trạng | Giá trị ban đầu |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 4123235 | Die casting T1-1 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 2 | CNC-001 | Máy phay CNC | XYZ-1000 · S/N 12345 | XYZ Corp | 2020 | 15/01/2020 | Xưởng A | Bộ phận Cơ khí | 3 tháng | Hoạt động | 500.000.000 ₫ |
| 3 | LATHE-002 | Máy tiện | ABC-2000 · S/N 67890 | ABC Inc | 2019 | 01/2019 | Xưởng A | Bộ phận Cơ khí | 3 tháng | Hoạt động | 300.000.000 ₫ |
| 4 | WELD-003 | Máy hàn | DEF-3000 · S/N 24680 | DEF Co | 2021 | 01/2021 | Xưởng B | Bộ phận Hàn | 3 tháng | Hoạt động | 100.000.000 ₫ |
| 5 | 4123241 | Die casting T1-5 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 6 | 4123217 | Die casting T1-6 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 7 | 4123238 | Die casting T1-7 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 8 | 4123216 | Die casting T1-8 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 9 | 4123218 | Die casting T1-9 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 10 | 4123240 | Die casting T1-10 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 11 | 4123239 | Die casting T1-11 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 12 | 4103111 | Die casting T1-12 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 13 | 4103110 | Die casting T1-13 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 14 | 4103112 | Die casting T1-14 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 15 | 4103116 | Die casting T1-15 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 16 | 4103115 | Die casting T1-16 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 17 | 4103114 | Die casting T1-17 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 18 | 4103109 | Die casting T1-18 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |
| 19 | 4103113 | Die casting T1-19 | BD-125V5EX | Toyo | — | — | — | Die casting | 3 tháng | — | — |

*(Các ô "—" là dữ liệu file gốc để trống — cần bổ sung khi rà soát thực tế.)*

## Quy trình quản lý danh mục

1. **Lập lần đầu:** Kỹ thuật/Bảo trì phối hợp Sản xuất/Kế toán thống kê toàn bộ thiết bị, nhập chi tiết thông số, chu kỳ bảo dưỡng, tình trạng. Danh mục là nền tảng cho lý lịch và kế hoạch bảo trì.
2. **Cập nhật thông tin:** khi mua mới, sửa chữa, bảo trì, chuyển vị trí, thanh lý — cập nhật **ngay**, gồm cả chu kỳ bảo dưỡng.
3. **Rà soát định kỳ:** 6 tháng/lần, Kỹ thuật/Bảo trì chủ trì đối chiếu thực tế; điều chỉnh chu kỳ bảo dưỡng nếu cần.
4. **Tra cứu:** tìm kiếm theo mã/vị trí/trạng thái; lập kế hoạch bảo trì; thống kê phục vụ ngân sách.

## Lưu ý chung

- **Tính nhất quán:** mã và tên thiết bị phải đồng nhất trên tất cả tài liệu.
- **Tích hợp dữ liệu:** chu kỳ bảo dưỡng đồng bộ giữa danh mục ↔ kế hoạch bảo dưỡng ↔ phiếu bảo trì.
- **Số hóa:** nên dùng phần mềm CMMS để tự động hóa lưu trữ và phân tích.
- **Đào tạo:** mọi nhân viên liên quan hiểu rõ cách dùng biểu mẫu.
