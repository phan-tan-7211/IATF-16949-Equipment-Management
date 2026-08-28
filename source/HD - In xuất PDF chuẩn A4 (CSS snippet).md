---
tags:
  - huong-dan
  - obsidian
  - xuat-pdf
created: 2026-08-21
---

# HD — In / Xuất PDF chuẩn A4 bằng CSS snippet

> [!abstract] Tóm tắt
> Vault đã cài sẵn snippet **`print-a4.css`** để khóa bố cục in: khổ A4, lề chuẩn, tự động ngắt trang, ẩn giao diện thừa. Quy trình in gọn còn: **Ctrl + P → Export to PDF → Enter**.

Về nhà: [[00 Mục lục - Hệ thống Quản lý Thiết bị]]

## 1. Bật snippet (làm 1 lần duy nhất)

1. Obsidian → **Settings** (⚙️) → **Appearance** (Giao diện)
2. Cuộn xuống cuối → **CSS snippets** → nhấn nút **Reload** (⟳)
3. Bật công tắc cho **print-a4**

## 2. Cách in mỗi khi cần

- Mở ghi chú → **Ctrl + P** → chọn **Export to PDF**
- **Lần đầu:** chọn khổ **A4** trong hộp thoại → Obsidian nhớ lựa chọn này cho mọi lần sau
- **Từ lần thứ 2:** chỉ việc Enter là ra PDF chuẩn

## 3. Đoạn CSS đã khóa những gì

| Vấn đề | Xử lý |
| --- | --- |
| Lề, khổ giấy | `@page` cố định **A4, lề 18/16/20/16 mm** — không phụ thuộc nội dung dài ngắn |
| Giao diện lẫn vào bản in | Ẩn properties/YAML, nút copy code, icon callout, mũi tên gập/mở, backlinks |
| Ngắt trang tự động | Mỗi **H1 sang trang mới** (trừ heading đầu file); heading không bị mồ côi cuối trang; bảng/code/callout/ảnh/sơ đồ mermaid không bị cắt đôi |
| Chữ | 11pt, bảng 9.5pt để vừa khổ; link in ra màu đen |

## 4. Ba mẹo nhỏ

- Muốn sang trang thủ công tại vị trí bất kỳ: chèn `<div class="page-break"></div>` vào ghi chú.
- Không muốn mỗi H1 sang trang riêng (ví dụ ghi chú ngắn): xóa khối `h1 { page-break-before: always; }` trong mục 3 của file CSS.
- File nằm ở `.obsidian\snippets\print-a4.css` — OneDrive đồng bộ theo vault nên máy khác cài Obsidian đăng nhập cùng tài khoản cũng có sẵn.

> [!note] Lưu ý cho trung thực
> Hộp thoại Export to PDF vẫn hiển thị tùy chọn khổ giấy/lề — CSS giữ vai trò "mặc định cứng" cho bố cục và ngắt trang, còn ô khổ giấy chỉ cần chốt **A4 một lần đầu tiên**. Sau đó quy trình 100% là Ctrl+P → Enter.

## 5. Sửa nội dung snippet khi cần

Mở file trực tiếp: `C:\Users\T\OneDrive\Documents\Obsidian Vault\.obsidian\snippets\print-a4.css`

Sau khi sửa xong phải quay lại **Settings → Appearance → CSS snippets → Reload** thì thay đổi mới có hiệu lực.
