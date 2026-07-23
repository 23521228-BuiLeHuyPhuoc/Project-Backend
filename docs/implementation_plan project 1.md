# 🎯 Kế Hoạch Triển Khai Recommender System — Phiên Bản Cập Nhật

## Tổng Quan

Xây dựng hệ thống đề xuất tour du lịch thông minh kết hợp **Collaborative Filtering** + **Content-Based Filtering**, sử dụng **Matrix Factorization (ALS/SVD)** trên server Node.js và **TensorFlow.js** trên trình duyệt.

> [!TIP]
> Project đã được nâng cấp đáng kể so với lần phân tích trước. Nhiều nền tảng cần thiết cho Recommender System **đã có sẵn**, giúp rút ngắn đáng kể thời gian triển khai.

---

## 📊 Phân Tích Hiện Trạng Project (Cập nhật 23/07/2026)

### ✅ Những gì ĐÃ CÓ (không cần làm lại)

| # | Tính năng | Trạng thái | Chi tiết |
|---|---|---|---|
| 1 | **Hệ thống Auth (JWT)** | ✅ Hoàn chỉnh | Đăng ký (có preferences), đăng nhập (remember me), quên MK (OTP hash + rate limit), JWT token, `requireAuth` + `optionalAuth` middleware |
| 2 | **User model** | ✅ Hoàn chỉnh | Có `preferences` (tourTypes, budgetRange, locations), `cart` embedded, `accountSeenAt`, password select:false |
| 3 | **Review/Rating (1-5 sao)** | ✅ Hoàn chỉnh | CRUD review, chỉ user đã mua + hoàn thành tour mới được đánh giá, compound unique index `{userId, tourId}`, admin management |
| 4 | **Favorite (Tour yêu thích)** | ✅ Hoàn chỉnh | Toggle yêu thích, danh sách yêu thích, compound unique index `{userId, tourId}` |
| 5 | **Notification** | ✅ Hoàn chỉnh | CRUD, đánh dấu đã đọc, đếm unread, nhiều loại (order, voucher, review, account, system) |
| 6 | **Voucher system** | ✅ Hoàn chỉnh | Ví voucher, claim/remove, validate + apply khi đặt hàng, atomic operations |
| 7 | **Order model** | ✅ Có userId | Liên kết với User, có `voucherCode`, `cancelledAt`, thanh toán ZaloPay + VnPay, rollback khi lỗi |
| 8 | **Account management** | ✅ Hoàn chỉnh | Dashboard, profile, orders, favorites, reviews, vouchers, notifications — tất cả trong `/account/*` |
| 9 | **Forgot Password (User)** | ✅ Bảo mật cao | OTP hash (bcrypt), rate limit (5 lần), JWT reset token, TTL index tự xóa |
| 10 | **Permission system (Admin)** | ✅ Hoàn chỉnh | RBAC dựa trên path + method, `authorizeByPath` middleware, quản lý quyền động |
| 11 | **Article/News** | ✅ Có | Static data (`data/news.data.js`) + views, tin tức du lịch |
| 12 | **Contact** | ✅ Nâng cấp | Hỗ trợ `message` + `newsletter`, status tracking, admin management |
| 13 | **Admin Dashboard** | ✅ Có | Dashboard tổng quan, quản lý review, voucher, order, contact, article... |
| 14 | **UI/Styling** | ✅ TailwindCSS v4 + DaisyUI | Không còn dùng Vanilla CSS/Pug inline, có design system |

### ❌ Những gì CÒN THIẾU cho Recommender System

| # | Tính năng | Trạng thái | Mức quan trọng |
|---|---|---|---|
| 1 | **UserInteraction model** | ❌ Chưa có | 🔴 Bắt buộc — nguồn dữ liệu chính cho ML |
| 2 | **Tracking middleware** (server-side) | ❌ Chưa có | 🔴 Bắt buộc — ghi nhận hành vi tự động |
| 3 | **Behavior tracker** (client-side JS) | ❌ Chưa có | 🟡 Quan trọng — view duration, scroll, hover |
| 4 | **Content-Based Filtering engine** | ❌ Chưa có | 🔴 Bắt buộc — engine đề xuất thứ 1 |
| 5 | **Collaborative Filtering engine** | ❌ Chưa có | 🔴 Bắt buộc — engine đề xuất thứ 2 |
| 6 | **Matrix Factorization (SVD/ALS)** | ❌ Chưa có | 🔴 Bắt buộc — core algorithm |
| 7 | **Hybrid Recommender engine** | ❌ Chưa có | 🔴 Bắt buộc — kết hợp 2 engine |
| 8 | **TensorFlow.js client-side** | ❌ Chưa có | 🟡 Nâng cao — real-time prediction trên browser |
| 9 | **Recommendation API** | ❌ Chưa có | 🔴 Bắt buộc — endpoints phục vụ frontend |
| 10 | **Tour model: ratingAvg/ratingCount** | ❌ Chưa có | 🟡 Quan trọng — feature cho Content-Based |
| 11 | **Caching layer** | ❌ Chưa có | 🟡 Quan trọng — performance |
| 12 | **Training scheduler** | ❌ Chưa có | 🟡 Quan trọng — cập nhật model |
| 13 | **Seed data script** | ❌ Chưa có | 🟡 Cần cho testing |

---

## 📋 Danh Sách Công Việc Theo Thứ Tự (Chỉ gồm phần CÒN THIẾU)

---

### 🔷 Giai Đoạn 1: Thu Thập Dữ Liệu Hành Vi (2-3 ngày)

> [!IMPORTANT]
> Đây là giai đoạn nền tảng. Không có dữ liệu hành vi = không có Recommender System. Nhờ Auth + Review + Favorite + Order đều đã có sẵn `userId`, giai đoạn này chỉ cần thêm **lớp tracking tổng hợp**.

---

#### ✅ Bước 1.1 — Tạo Model `UserInteraction`

**File mới:** `models/user-interaction.model.js`

```js
{
  userId: { type: ObjectId, ref: 'User', index: true },
  tourId: { type: ObjectId, ref: 'Tour', required: true, index: true },
  type: {
    type: String,
    enum: ["view", "favorite", "cart_add", "purchase", "rating", "search", "click_recommendation"],
    required: true
  },
  value: { type: Number, default: 1 },      // rating 1-5, view duration (giây), implicit weight
  metadata: {
    searchQuery: String,
    viewDuration: Number,                     // giây
    scrollDepth: Number,                      // 0-100%
    source: {                                 // người dùng đến từ đâu
      type: String,
      enum: ["home", "category", "search", "recommendation", "favorite", "direct"]
    },
    deviceType: String                        // mobile/desktop/tablet
  },
  sessionId: String                           // cho anonymous user
}
// timestamps: true, compound index: { userId, tourId, type }
```

**📌 Lý do:** Đây là **bảng trung tâm** tổng hợp tất cả tương tác từ nhiều nguồn (view, favorite, order, review) vào 1 nơi. Tại sao không dùng trực tiếp bảng `Favorite` + `Review` + `Order`?

1. **Thống nhất format**: ML model cần 1 data source nhất quán, không phải query 4 bảng rồi merge
2. **Ghi nhận hành vi mà các model khác không capture**: `view` (xem trang), `search` (tìm kiếm), `click_recommendation` (click vào gợi ý), `cart_add` (thêm giỏ hàng)
3. **Metadata bổ sung**: `viewDuration`, `scrollDepth`, `source` — những tín hiệu quan trọng cho ML mà Favorite/Review/Order không lưu
4. **Hỗ trợ anonymous user**: Bằng `sessionId` cho user chưa đăng nhập (Favorite/Review yêu cầu login)

**Trọng số implicit rating:**

| Hành vi | Weight | Nguồn dữ liệu |
|---|---|---|
| `view` | 1 | Tracking middleware (MỚI) |
| `search` | 1.5 | Tracking middleware (MỚI) |
| `favorite` | 2 | Sync từ Favorite model (ĐÃ CÓ) |
| `cart_add` | 3 | Tracking middleware (MỚI) |
| `rating` | Giá trị 1-5 | Sync từ Review model (ĐÃ CÓ) |
| `purchase` | 5 | Sync từ Order model (ĐÃ CÓ) |
| `click_recommendation` | 2.5 | Client-side tracker (MỚI) |

---

#### ✅ Bước 1.2 — Tạo Tracking Middleware (server-side)

**File mới:** `middlewares/client/tracking.middleware.js`

**📌 Lý do:** Middleware tự động ghi nhận hành vi mà **không cần sửa code** trong các controller hiện có. Tuân thủ nguyên tắc Open/Closed — mở rộng bằng cách thêm middleware, không sửa đổi logic nghiệp vụ hiện tại.

**Công việc cụ thể:**
- Gắn vào `index.route.js` sau `optionalAuth` → có `req.user` hoặc `sessionId`
- Track `view` khi user truy cập `/tour/detail/:slug` (dùng `res.on('finish')` để không block response)
- Track `search` khi user truy cập `/search`
- Track `cart_add` khi POST `/cart` (hook vào middleware chain)

**Sync dữ liệu từ model đã có:**
- Khi **Review** được tạo (bước 1B.3 cũ) → tự động tạo UserInteraction `type="rating"`
- Khi **Favorite** toggle → tự động tạo/xóa UserInteraction `type="favorite"`
- Khi **Order** hoàn thành → tự động tạo UserInteraction `type="purchase"`

Cách sync: Thêm logic sync vào cuối các controller tương ứng (review.controller, favorite.controller, order process) — **chỉ thêm 1-2 dòng mỗi file, không refactor**.

---

#### ✅ Bước 1.3 — Tạo Behavior Tracker (client-side JS)

**File mới:** `public/assets/js/behavior-tracker.js`

**📌 Lý do:** Server-side tracking chỉ biết "user đã mở trang". Client-side tracking biết **"user đã làm gì trên trang"**:

| Hành vi client-side | Ý nghĩa cho Recommender |
|---|---|
| Thời gian xem trang tour | > 30s = quan tâm thật, < 5s = lướt qua |
| Scroll depth trên tour detail | > 80% = đọc kỹ lịch trình |
| Hover trên tour card (home/category) | Đang cân nhắc giữa các tour |
| Tương tác với review section | Đọc review = gần quyết định mua |
| Click vào tour từ section recommendation | Feedback trực tiếp cho Recommender |

**Công việc cụ thể:**
- Thu thập: `viewDuration`, `scrollDepth`, `clickEvents` trên trang tour detail
- **Batch gửi** lên server mỗi 30 giây hoặc khi user rời trang (`beforeunload`/`visibilitychange`)
- API endpoint: `POST /api/tracking/events` (gom nhiều event trong 1 request)
- Lưu `sessionId` vào `localStorage` cho anonymous user

---

#### ✅ Bước 1.4 — Tạo Tracking API & Cập nhật Tour model

**File mới:** `routes/client/tracking.route.js`
**File mới:** `controllers/client/tracking.controller.js`
**Sửa file:** `models/tour.model.js` — thêm `ratingAvg`, `ratingCount`

```
POST /api/tracking/events     → Batch nhận events từ client-side tracker
GET  /api/tracking/stats      → (Admin) Thống kê tổng quan tracking data
```

**Thêm vào Tour model:**
```js
{
  ratingAvg: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 }
}
```

**📌 Lý do về Tour model update:**
- `review.controller.js` hiện có function `updateTourRating()` nhưng **chưa thực sự update Tour** — chỉ aggregate mà không save. Cần hoàn thiện để lưu `ratingAvg` + `ratingCount` vào Tour
- `ratingAvg` trở thành **feature quan trọng** cho Content-Based Filtering
- Cho phép hiển thị rating trên tour card mà không cần query Review collection

---

#### ✅ Bước 1.5 — Tạo Script Seed Data

**File mới:** `scripts/seed-interactions.js`

**📌 Lý do:** Collaborative Filtering cần **ít nhất 50-100 user** và **vài trăm interaction records** để ma trận User-Item đủ "dày" cho Matrix Factorization. Script sẽ:

- Tạo 100 user giả với preferences đa dạng
- Tạo 500+ interaction records (view, favorite, cart_add, purchase) với **pattern rõ ràng**:
  - Nhóm user A: thích tour biển → view/purchase nhiều tour biển
  - Nhóm user B: thích tour núi → view/purchase nhiều tour núi
  - Cross-group: một vài user thích cả 2 → tạo "cầu nối" cho Collaborative Filtering
- Tạo 200+ review với rating 1-5 (phân bố realistic: bell curve quanh 4 sao)
- Cập nhật `ratingAvg` + `ratingCount` cho mỗi Tour

---

### 🔷 Giai Đoạn 2: Content-Based Filtering Engine (2-3 ngày)

---

#### ✅ Bước 2.1 — Tạo Feature Extractor

**File mới:** `services/recommendation/feature-extractor.js`

**📌 Lý do:** Content-Based so sánh đặc trưng giữa các tour. Cần chuyển thông tin tour thành **vector số**. Đây là engine hoạt động **ngay lập tức** với dữ liệu hiện có — không cần chờ user data.

**Features sẽ trích xuất từ Tour model hiện tại:**

| Feature | Nguồn | Encoding |
|---|---|---|
| `category` | `tour.category` (ObjectId) | One-hot |
| `price range` | `tour.priceNewAdult` | Normalize [0, 1] |
| `locations` | `tour.locations` (Array ObjectId) | Multi-hot |
| `duration` | `tour.time` (String, ví dụ "3N2Đ") | Parse → Normalize |
| `vehicle` | `tour.vehicle` (String) | One-hot |
| `departure season` | `tour.departureDate` | Season encoding (xuân/hạ/thu/đông) |
| `ratingAvg` ⭐ | `tour.ratingAvg` (MỚI từ Bước 1.4) | Normalize [0, 1] |
| `ratingCount` ⭐ | `tour.ratingCount` (MỚI từ Bước 1.4) | Log normalize |

**Cosine Similarity:**
```
similarity(A, B) = (A · B) / (||A|| × ||B||)

Ví dụ:
Tour Đà Lạt  = [0, 1, 0, 0.3, 1, 0, 0, 0.5, 0.8, 0.6]
Tour Nha Trang = [1, 0, 0, 0.4, 0, 1, 0, 0.6, 0.9, 0.7]
→ similarity = 0.42 (khác nhau nhiều)

Tour Đà Lạt  = [0, 1, 0, 0.3, 1, 0, 0, 0.5, 0.8, 0.6]
Tour Sapa     = [0, 1, 0, 0.35, 1, 0, 0, 0.4, 0.7, 0.5]
→ similarity = 0.95 (rất giống nhau) ✅
```

---

#### ✅ Bước 2.2 — Xây dựng Content-Based Recommender

**File mới:** `services/recommendation/content-based.js`

**📌 Lý do:** Trả lời 2 câu hỏi:
1. *"Tour nào giống với tour user đang xem?"* → Dùng cho trang tour detail
2. *"Tour nào phù hợp với sở thích của user?"* → Dùng cho trang home (personalized)

**Thuật toán xây dựng User Profile:**
```
1. Lấy tất cả tour user đã tương tác (từ UserInteraction + Review + Favorite)
2. Tính weighted average vector:
   - Tour user rate 5★ → weight = 5
   - Tour user rate 1★ → weight = 1
   - Tour user favorite → weight = 2
   - Tour user chỉ view → weight = 1
3. Nếu user có preferences (từ đăng ký) → mix vào profile vector
4. So sánh cosine similarity với tất cả tour chưa tương tác
5. Trả về top-N
```

**Ưu điểm tận dụng dữ liệu hiện có:**
- `user.preferences.tourTypes` → biết user thích loại tour gì (khai báo khi đăng ký)
- `user.preferences.budgetRange` → biết ngân sách
- `user.preferences.locations` → biết địa điểm yêu thích
- `Review.rating` → explicit feedback chính xác
- `Favorite` records → implicit positive signal

---

### 🔷 Giai Đoạn 3: Collaborative Filtering + Matrix Factorization (3-4 ngày)

---

#### ✅ Bước 3.1 — Xây dựng ma trận User-Item

**File mới:** `services/recommendation/matrix-builder.js`

**📌 Lý do:** Ma trận User-Item là **cấu trúc dữ liệu trung tâm** của Collaborative Filtering. Nhờ project đã có `userId` ở Order, Review, Favorite, việc xây dựng ma trận trở nên thuận lợi hơn nhiều.

**Nguồn dữ liệu (ưu tiên explicit > implicit):**

```
Ưu tiên 1: Review.rating (1-5 ★)      → Explicit, chính xác nhất
Ưu tiên 2: Order.status = "completed"  → Implicit, weight = 5
Ưu tiên 3: Favorite records            → Implicit, weight = 2
Ưu tiên 4: UserInteraction (view, search, cart_add) → Implicit, weight = 1-3
```

**Xử lý ma trận thưa (Sparse Matrix):**
- Dự kiến: 100 users × 50 tours = 5000 ô → 90%+ bằng 0
- Sử dụng compressed format (chỉ lưu ô có giá trị) để tiết kiệm bộ nhớ

---

#### ✅ Bước 3.2 — Triển khai Matrix Factorization (SVD/ALS)

**File mới:** `services/recommendation/matrix-factorization.js`

**📌 Lý do:** Phân rã ma trận thưa thành 2 ma trận latent factors → dự đoán giá trị cho ô trống = dự đoán tour user sẽ thích.

**SVD (Singular Value Decomposition):**
```
R ≈ U × Σ × V^T

R (m×n): Ma trận User-Item
U (m×k): Latent factors của User
V (n×k): Latent factors của Tour
k: số chiều ẩn (10-50)
```

**ALS (Alternating Least Squares):**
```
R ≈ X × Y^T

Lặp lại cho đến khi hội tụ:
  Bước 1: Cố định Y, giải X bằng Least Squares
  Bước 2: Cố định X, giải Y bằng Least Squares
```

**Chọn ALS làm thuật toán chính** vì:
- Xử lý tốt **implicit feedback** (phần lớn data từ view, favorite — không phải rating)
- Xử lý tốt **sparse matrix** (ma trận rất thưa với ít user ban đầu)
- SVD làm thuật toán phụ/so sánh

**Thư viện:** `ml-matrix` cho phép toán ma trận, hoặc tự implement ALS (~200 dòng code)

---

#### ✅ Bước 3.3 — Tạo Collaborative Filtering Recommender

**File mới:** `services/recommendation/collaborative-filtering.js`

**📌 Lý do:** Module truy vấn kết quả từ model đã train.

**Luồng xử lý:**
```
1. Nhận userId
2. Lấy latent vector U[userId] từ model đã train
3. Nhân U[userId] × V^T → predicted rating cho tất cả tour
4. Lọc bỏ tour đã mua/xem/hết hạn/bị xóa
5. Sắp xếp giảm dần
6. Trả về top-N recommendations
```

---

### 🔷 Giai Đoạn 4: Hybrid Engine + TensorFlow.js (3-4 ngày)

---

#### ✅ Bước 4.1 — Xây dựng Hybrid Recommender Engine

**File mới:** `services/recommendation/hybrid-engine.js`

**📌 Lý do:** Kết hợp ưu điểm của cả 2 engine, bù đắp điểm yếu lẫn nhau.

```
Score_final = α × Score_content + β × Score_collaborative + γ × Score_popularity

Chiến lược điều chỉnh trọng số tự động:
┌─────────────────────────────────────────────────────────┐
│ Loại user              │  α (CB)  │  β (CF)  │  γ (Pop) │
│────────────────────────┼──────────┼──────────┼──────────│
│ Mới, có preferences    │  0.6     │  0.1     │  0.3     │
│ Mới, không preferences │  0.2     │  0.1     │  0.7     │
│ Có 5-20 interactions   │  0.4     │  0.4     │  0.2     │
│ Có 20+ interactions    │  0.2     │  0.7     │  0.1     │
│ Anonymous (no login)   │  0.1     │  0.0     │  0.9     │
└─────────────────────────────────────────────────────────┘

Score_popularity tính từ:
  - ratingAvg ⭐ (từ Review — ĐÃ CÓ)
  - ratingCount (số lượt đánh giá — ĐÃ CÓ)
  - Số lượt favorite (query Favorite — ĐÃ CÓ)
  - Số lượt purchase (query Order — ĐÃ CÓ)
  - Số lượt view (query UserInteraction — MỚI)
```

**Business rules filter:**
- Loại tour `deleted: true`
- Loại tour `status: "inactive"`
- Loại tour đã hết `departureDate` (< ngày hiện tại)
- Loại tour hết slot (`stockAdult <= 0`)

---

#### ✅ Bước 4.2 — Tạo Training Scheduler

**File mới:** `services/recommendation/training-scheduler.js`

**📌 Lý do:** Model ML cần được train lại định kỳ khi có dữ liệu mới.

- **Chạy re-training** mỗi 6 giờ (configurable qua `.env`)
- **Cache model** trong memory → trả kết quả nhanh
- **Log metrics:** RMSE, MAE, Precision@K
- Lưu model xuống JSON file → khôi phục khi server restart
- **Trigger re-train sớm** khi có > N interactions mới kể từ lần train trước

---

#### ✅ Bước 4.3 — Tích hợp TensorFlow.js phía Client

**File mới:** `public/assets/js/recommendation-engine.js`

**📌 Lý do:** Chạy ML **trực tiếp trên browser** để real-time re-ranking.

**Công việc:**
1. Server export model sang format TensorFlow.js (`model.json` + weights)
2. Client load model, nhận danh sách tour candidate từ API
3. Re-rank dựa trên **real-time context:**
   - Thời gian trong ngày (sáng → tour outdoor, tối → tour city)
   - Hành vi session hiện tại (đã xem 3 tour biển → boost tour biển)
   - Device type (mobile → tour ngắn ngày, desktop → tour dài ngày)
4. Hiển thị kết quả đã re-rank

**API mới cần thêm:**
```
GET /api/recommendation/model       → Download TF.js model files
GET /api/recommendation/metadata    → Feature names, normalization params
```

---

### 🔷 Giai Đoạn 5: API, Tích Hợp Giao Diện & Tối Ưu (2-3 ngày)

---

#### ✅ Bước 5.1 — Tạo Recommendation API

**File mới:** `routes/client/recommendation.route.js`
**File mới:** `controllers/client/recommendation.controller.js`

```
GET  /api/recommendation/personalized?limit=10
     → Tour đề xuất cá nhân hóa (Hybrid engine, dùng req.user từ optionalAuth)

GET  /api/recommendation/similar/:tourId?limit=6
     → Tour tương tự (Content-Based, dùng trên trang tour detail)

GET  /api/recommendation/trending?limit=8
     → Tour trending (Popularity-based, dùng cho tất cả user)

GET  /api/recommendation/top-rated?limit=8
     → Tour rating cao nhất (dùng ratingAvg từ Review — ĐÃ CÓ)

POST /api/recommendation/feedback
     → User click/ignore recommendation → feedback cho model
```

**📌 Lý do tách API riêng:**
1. **Lazy loading**: Trang load trước, recommendation load sau bằng AJAX → UX nhanh
2. **Caching riêng**: Cache recommendation response 15-30 phút
3. **A/B testing**: Dễ thay đổi thuật toán mà không ảnh hưởng giao diện
4. **Reusable**: Gọi từ nhiều trang (home, detail, cart, order-success)

---

#### ✅ Bước 5.2 — Tích hợp vào giao diện

**Sửa file:** `views/client/pages/home.pug`
```
Thêm 2 section mới (load bằng AJAX):
- "Dành riêng cho bạn"     → GET /api/recommendation/personalized (nếu login)
- "Tour được đánh giá cao" → GET /api/recommendation/top-rated
```

**Sửa file:** `views/client/pages/tour-detail.pug`
```
Thêm 2 section cuối trang (load bằng AJAX):
- "Tour tương tự"          → GET /api/recommendation/similar/:tourId
- "Bạn có thể thích"       → GET /api/recommendation/personalized (nếu login)
```

**Sửa file:** `views/client/pages/order-success.pug`
```
Thêm 1 section (load bằng AJAX):
- "Tour bạn có thể thích"  → GET /api/recommendation/personalized
```

**File mới:** `views/client/partials/recommendation-section.pug` — Pug mixin tái sử dụng cho recommendation cards

**📌 Lý do:** Dùng AJAX để load recommendation **không ảnh hưởng page load speed**. Section recommendation render sau 200-300ms, user không cảm thấy chậm.

---

#### ✅ Bước 5.3 — Caching Layer

**File mới:** `services/recommendation/cache-manager.js`

**📌 Lý do:** Recommendation engine tính toán nặng (query + matrix operations). Cache giúp:
- Trả kết quả < 50ms (thay vì 200-500ms)
- Giảm tải MongoDB
- TTL 15-30 phút, invalidate khi model re-train
- **Invalidate cache cụ thể** khi user tạo review/favorite mới (thay vì clear all)

**Thư viện:** `lru-cache` — lightweight, in-memory, có TTL

---

#### ✅ Bước 5.4 — Admin Monitoring Dashboard

**Sửa file:** `views/admin/pages/dashboard.pug` — thêm tab/section recommendation metrics

**📌 Lý do:** Admin cần đánh giá hiệu quả Recommender:

| Metric | Ý nghĩa | Nguồn |
|---|---|---|
| CTR | % click vào tour recommended | UserInteraction `type="click_recommendation"` |
| Conversion Rate | % mua tour từ recommendation | Order + UserInteraction |
| Avg Rating | Rating trung bình hệ thống | Review (ĐÃ CÓ) |
| Review Coverage | % tour có ít nhất 1 review | Review (ĐÃ CÓ) |
| Model RMSE/MAE | Sai số dự đoán | Training scheduler |
| Last Training | Thời gian train gần nhất | Training scheduler |

---

## 📦 Thư Viện Cần Cài Thêm

| Thư viện | Mục đích | Giai đoạn |
|---|---|---|
| `ml-matrix` | Phép toán ma trận (SVD, ALS) | GĐ 3 |
| `@tensorflow/tfjs-node` | Train model trên server | GĐ 3, 4 |
| `@tensorflow/tfjs` | Inference trên browser (CDN) | GĐ 4 |
| `node-cron` | Scheduler re-training | GĐ 4 |
| `lru-cache` | In-memory cache | GĐ 5 |

> [!NOTE]
> Tất cả thư viện khác đã có sẵn: `bcrypt`, `jsonwebtoken`, `mongoose`, `moment`, `joi`, `cloudinary`, `multer`, `nodemailer`, `axios`...

---

## 📁 Cấu Trúc File Mới (Chỉ phần thêm mới cho Recommender)

```
project1/
├── models/
│   ├── user-interaction.model.js            ← [MỚI] Thu thập hành vi
│   └── tour.model.js                        ← [SỬA] Thêm ratingAvg, ratingCount
├── services/
│   └── recommendation/
│       ├── feature-extractor.js             ← [MỚI] Trích xuất đặc trưng tour
│       ├── content-based.js                 ← [MỚI] Content-Based engine
│       ├── matrix-builder.js                ← [MỚI] Xây dựng ma trận User-Item
│       ├── matrix-factorization.js          ← [MỚI] SVD/ALS algorithms
│       ├── collaborative-filtering.js       ← [MỚI] Collaborative engine
│       ├── hybrid-engine.js                 ← [MỚI] Kết hợp 2 engine
│       ├── training-scheduler.js            ← [MỚI] Scheduler re-train
│       └── cache-manager.js                 ← [MỚI] LRU cache layer
├── controllers/
│   └── client/
│       ├── tracking.controller.js           ← [MỚI] API tracking events
│       ├── recommendation.controller.js     ← [MỚI] API recommendation
│       ├── review.controller.js             ← [SỬA] Sync → UserInteraction
│       ├── favorite.controller.js           ← [SỬA] Sync → UserInteraction
│       └── order.controller.js              ← [SỬA] Sync → UserInteraction
├── routes/
│   └── client/
│       ├── tracking.route.js                ← [MỚI]
│       ├── recommendation.route.js          ← [MỚI]
│       └── index.route.js                   ← [SỬA] Thêm tracking + recommendation routes
├── middlewares/
│   └── client/
│       └── tracking.middleware.js           ← [MỚI] Auto-tracking views/search
├── public/
│   └── assets/js/
│       ├── behavior-tracker.js              ← [MỚI] Client-side hành vi tracking
│       └── recommendation-engine.js         ← [MỚI] TensorFlow.js client-side
├── views/
│   └── client/
│       ├── partials/
│       │   └── recommendation-section.pug   ← [MỚI] Mixin hiển thị tour gợi ý
│       └── pages/
│           ├── home.pug                     ← [SỬA] Thêm section đề xuất
│           ├── tour-detail.pug              ← [SỬA] Thêm tour tương tự
│           └── order-success.pug            ← [SỬA] Thêm gợi ý sau đặt hàng
├── scripts/
│   └── seed-interactions.js                 ← [MỚI] Generate fake data để test
└── views/admin/pages/
    └── dashboard.pug                        ← [SỬA] Thêm metrics recommendation
```

---

## ⏱ Ước Tính Thời Gian (Cập nhật)

| Giai đoạn | Công việc | Thời gian | So sánh trước |
|---|---|---|---|
| **GĐ 1** | Thu thập dữ liệu hành vi (UserInteraction, Tracking, Seed data) | 2-3 ngày | ~~6-8 ngày~~ → giảm nhờ Auth + Review + Favorite đã có |
| **GĐ 2** | Content-Based Filtering | 2-3 ngày | Giữ nguyên |
| **GĐ 3** | Collaborative Filtering + Matrix Factorization | 3-4 ngày | Giữ nguyên |
| **GĐ 4** | Hybrid Engine + TensorFlow.js + Scheduler | 3-4 ngày | Gộp từ GĐ 4+5 cũ |
| **GĐ 5** | API + Giao diện + Caching + Monitoring | 2-3 ngày | Gộp từ GĐ 6+7 cũ |
| **Tổng** | | **~12-17 ngày** | ~~20-28 ngày~~ → **giảm ~40%** |

> [!TIP]
> Nhờ các nền tảng Auth, Review, Favorite, Order, Notification đã hoàn thiện, **thời gian triển khai giảm từ 20-28 ngày xuống còn 12-17 ngày**. Phần lớn công việc hiện tại là xây dựng thuật toán ML (GĐ 2-4).

---

## Open Questions

> [!NOTE]
> **Quy mô dữ liệu:** Hiện tại project có khoảng bao nhiêu tour trong database? Và dự kiến bao nhiêu user đăng ký? Điều này ảnh hưởng đến số lượng latent factors (k) trong Matrix Factorization và chiến lược caching.
