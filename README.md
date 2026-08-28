# IATF 16949 Equipment Management

Ứng dụng quản lý thiết bị sản xuất và thiết bị đo lường/QC theo hướng IATF 16949.

## Mục tiêu V1

- Equipment Master
- Maintenance / Repair Log
- Calibration Log
- Preventive Maintenance Plan
- Equipment Movement History
- Audit Log
- PWA chạy chung trên PC và mobile
- Google Sheets/Drive là nguồn dữ liệu giai đoạn đầu, truy cập qua backend API; frontend không giữ credential Google
- Không quản lý giá tiền hoặc chi phí

## Kiến trúc

```text
React + TypeScript + Vite PWA
        |
        v
Backend API / Google Apps Script or Node API
        |
        +--> Private Google Sheets
        +--> Private Google Drive
```

Repo này được khởi tạo từ phần hạ tầng UI/PWA ổn định của `so-nho-accounting`, nhưng không mang theo bất kỳ domain TT58/accounting nào.
