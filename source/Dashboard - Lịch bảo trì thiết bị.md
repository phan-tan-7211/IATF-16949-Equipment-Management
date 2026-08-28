---
tags:
  - IATF16949
  - dashboard
created: 2026-08-21
---

# Dashboard — Lịch bảo trì thiết bị

> [!info] Cách hoạt động
> Bảng dưới đây do plugin **Dataview** tự quét mọi hồ sơ trong `03 Hồ sơ thiết bị/`. Muốn thêm máy vào theo dõi: nhân bản [[Mẫu - Lý lịch thiết bị]], điền thuộc tính `equipment-status`, `next-pm-date`, `pm-frequency` là máy tự xuất hiện ở đây.
>
> **Sau mỗi lần bảo dưỡng xong:** mở hồ sơ máy → đẩy `next-pm-date` sang chu kỳ kế tiếp → máy tự rời khỏi bảng cảnh báo.

Về nhà: [[00 Mục lục - Hệ thống Quản lý Thiết bị]]

## ⚠️ Quá hạn bảo dưỡng

```dataview
TABLE next-pm-date AS "Đến hạn", pm-frequency AS "Chu kỳ", equipment-grade AS "Cấp", owner AS "Bộ phận"
FROM "Công ty TNHH COREELECTRONICS VN/Hệ thống Quản lý Thiết bị/03 Hồ sơ thiết bị"
WHERE next-pm-date AND equipment-status = "active" AND next-pm-date < date(today)
SORT next-pm-date ASC
```

## 📅 Đến hạn trong 7 ngày tới

```dataview
TABLE next-pm-date AS "Ngày BD", pm-frequency AS "Chu kỳ", equipment-grade AS "Cấp", owner AS "Bộ phận"
FROM "Công ty TNHH COREELECTRONICS VN/Hệ thống Quản lý Thiết bị/03 Hồ sơ thiết bị"
WHERE next-pm-date AND equipment-status = "active" AND next-pm-date >= date(today) AND next-pm-date <= date(today) + dur(7 days)
SORT next-pm-date ASC
```

## 🗓️ Toàn bộ lịch bảo trì

```dataview
TABLE next-pm-date AS "Ngày BD tới", pm-frequency AS "Chu kỳ", equipment-grade AS "Cấp", equipment-status AS "Trạng thái"
FROM "Công ty TNHH COREELECTRONICS VN/Hệ thống Quản lý Thiết bị/03 Hồ sơ thiết bị"
WHERE next-pm-date
SORT next-pm-date ASC
```

## 🔧 Máy đang sửa chữa / ngưng hoạt động

```dataview
TABLE equipment-status AS "Trạng thái", next-pm-date AS "Ngày BD tới"
FROM "Công ty TNHH COREELECTRONICS VN/Hệ thống Quản lý Thiết bị/03 Hồ sơ thiết bị"
WHERE equipment-status AND equipment-status != "active"
SORT file.name ASC
```

## Quy tắc vận hành

1. **Bảo dưỡng xong** → cập nhật `next-pm-date` trong hồ sơ máy (chu kỳ kế tiếp theo `pm-frequency`).
2. **Máy hỏng đang sửa** → đổi `equipment-status: under-repair`; sửa xong trả về `active`.
3. **Thanh lý** → đổi `equipment-status: retired`, máy rời toàn bộ bảng cảnh báo nhưng vẫn giữ hồ sơ.
4. Khi auditor hỏi *"Máy X bảo dưỡng lần cuối khi nào?"* → mở hồ sơ máy, xem mục lịch sử BD/SC và các backlink tới phiếu [[BM-TBSX-07 Phiếu bảo dưỡng dự báo]], [[BM-TBSX-04 Sổ theo dõi bảo dưỡng sửa chữa thiết bị]].
