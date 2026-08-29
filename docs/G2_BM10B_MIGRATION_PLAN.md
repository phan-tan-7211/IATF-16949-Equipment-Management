# Kế hoạch migration G2 — BM-TBSX-10 Phần B

> Trạng thái: Đề xuất, **chưa áp dụng vào G1**
>
> Mục tiêu: bổ sung quản lý chương trình thay mới dụng cụ nhanh hỏng đúng nguồn BM-TBSX-10 Phần B mà không nhét dữ liệu vào cột ghi chú và không phá contract `G1-frozen-2026-08-28`.

## 1. Lý do cần migration

BM-TBSX-10 có hai phần nghiệp vụ khác nhau:

- Phần A: kế hoạch kiểm tra / bảo trì jig, gá, khuôn, dao cụ.
- Phần B: chương trình thay mới dụng cụ nhanh hỏng.

G1 hiện có `Tooling_Maintenance_Plan`, phù hợp với Phần A nhưng không đủ trường cấu trúc cho Phần B.

Các trường nguồn BM-10B chưa có nơi lưu chuẩn:

- tên dụng cụ;
- dùng cho máy / sản phẩm;
- tiêu chuẩn thay mới;
- tồn kho tối thiểu;
- chu kỳ đặt mua;
- nơi đặt mua;
- người theo dõi.

Không được đưa các trường này vào `note` vì sẽ mất khả năng lọc, cảnh báo, tính toán và audit theo trường.

## 2. Nguyên tắc dữ liệu

Một dụng cụ nhanh hỏng vẫn phải có một mã gốc trong `Tooling_Master` với:

```text
toolingType = PERISHABLE_TOOL
```

BM-10B không tạo một danh mục dụng cụ thứ hai.

Luồng:

```text
Tooling_Master
    ↓ toolingId
Chương trình thay mới dụng cụ nhanh hỏng
    ↓
Theo dõi ngưỡng / chu kỳ đặt mua
    ↓
Đề xuất mua / thay mới
```

## 3. Bảng đề xuất mới

Tên đề xuất:

```text
Tooling_Replacement_Program
```

Đây là bảng nghiệp vụ con của `Tooling_Master`, không phải master mới.

### Trường đề xuất

| Trường | Kiểu | Bắt buộc | Nguồn / ý nghĩa |
| --- | --- | --- | --- |
| `replacementProgramId` | text | Có | Mã giao dịch chương trình |
| `toolingId` | text | Có | Tham chiếu `Tooling_Master.toolingId` |
| `replacementCriterion` | text | Có | Tiêu chuẩn thay mới theo BM-10B |
| `minimumStock` | integer >= 0 | Có | Tồn kho tối thiểu |
| `purchaseCycleType` | enum | Có | Đơn vị chu kỳ đặt mua |
| `purchaseCycleValue` | integer > 0 | Có | Giá trị chu kỳ |
| `supplier` | text | Không | Nơi đặt mua |
| `responsiblePerson` | text | Không | Người theo dõi |
| `active` | boolean | Có | Chương trình còn hiệu lực |
| `updatedAt` | ISO datetime | Có | Chống ghi đè / audit |

### Giá trị `purchaseCycleType` đề xuất

```text
DAY
WEEK
MONTH
USE_COUNT
OUTPUT_COUNT
MANUAL_REVIEW
```

Không tự suy ra chu kỳ từ mô tả tự do.

## 4. Dữ liệu không sao chép

Các thông tin sau lấy từ `Tooling_Master` bằng `toolingId`, không nhập lại:

- tên dụng cụ;
- loại dụng cụ;
- dùng cho máy / sản phẩm / line;
- sở hữu;
- bộ phận chủ quản;
- vị trí;
- trạng thái.

Như vậy vẫn giữ nguyên nguyên tắc:

> một dụng cụ = một mã gốc = nhiều nghiệp vụ con.

## 5. Quy tắc nghiệp vụ

Chỉ cho tạo chương trình BM-10B khi:

```text
Tooling_Master.toolingType = PERISHABLE_TOOL
```

Không cho tạo cho Jig/Gá/Khuôn thông thường.

Một dụng cụ có thể có lịch sử nhiều chương trình, nhưng tại một thời điểm chỉ nên có tối đa một chương trình `active = true`.

Khi thay đổi tiêu chuẩn hoặc chu kỳ:

- không ghi đè lịch sử không dấu vết;
- ghi Audit Log trước/sau;
- dùng `expectedUpdatedAt` để chống ghi đè đồng thời.

## 6. Cảnh báo nghiệp vụ dự kiến

Khi có dữ liệu tồn kho thực tế trong tương lai:

```text
Tồn kho hiện tại <= minimumStock
→ cảnh báo cần đặt mua
```

G2 BM-10B **chưa tự tạo Purchase Order** vì nguồn hiện tại không định nghĩa quy trình mua hàng.

Hệ thống chỉ cảnh báo / tạo yêu cầu nghiệp vụ nếu sau này có source được phê duyệt.

## 7. Migration persistence contract

Không sửa trực tiếp `G1-frozen-2026-08-28`.

Khi được duyệt triển khai, tạo contract mới, ví dụ:

```text
G2-tooling-replacement-YYYY-MM-DD
```

Thay đổi:

```text
20 bảng G1
+ Tooling_Replacement_Program
= 21 bảng G2
```

Các 20 bảng G1 giữ nguyên tên và ý nghĩa.

## 8. Migration Google Sheet

Quy trình an toàn:

1. Sao lưu canonical Sheet trước migration.
2. Tạo sheet `Tooling_Replacement_Program` với header chính xác theo contract G2.
3. Không seed dòng ví dụ từ BM-10B vì nguồn chỉ là template.
4. Cập nhật `PERSISTENCE_TABLES` và `APP_CONFIG.allowedTables` cùng một commit.
5. Thêm schema TypeScript + test.
6. Thêm Apps Script create/update/deactivate với RBAC và Audit Log.
7. Thêm UI vào khu vực Dụng cụ sản xuất.
8. Test hoàn toàn trên fixture trước.
9. Chỉ sau khi fixture PASS mới deploy production.

## 9. Điều kiện chấp nhận G2 BM-10B

- Không tạo master dụng cụ thứ hai.
- `toolingId` là khóa liên kết duy nhất về `Tooling_Master`.
- Không dùng `note` thay cho các trường BM-10B.
- Chỉ `PERISHABLE_TOOL` được có chương trình thay mới.
- Có optimistic concurrency.
- Có Audit Log trước/sau.
- Không seed dữ liệu template thành production.
- CI Test + Build + Lint PASS.
- Fixture smoke PASS trước production.

## 10. Trạng thái release hiện tại

BM-10B được ghi nhận là **planned G2 migration**.

Release G1 hiện tại tiếp tục hỗ trợ:

- BM-09 Tooling Master;
- BM-10 Phần A kế hoạch kiểm tra/bảo trì;
- BM-11 thay đổi thiết kế/sửa đổi.

Không được tuyên bố BM-10B đã hoàn tất cho tới khi contract G2 được duyệt và migration thực hiện đầy đủ.
