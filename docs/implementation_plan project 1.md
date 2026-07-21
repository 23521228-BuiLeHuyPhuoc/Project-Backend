# 🎯 Kế Hoạch Triển Khai Recommender System — Đề Xuất Tour Du Lịch Thông Minh

## Tổng Quan

Xây dựng hệ thống đề xuất tour du lịch thông minh kết hợp **Collaborative Filtering** (lọc cộng tác) và **Content-Based Filtering** (lọc dựa trên nội dung), sử dụng **Matrix Factorization (ALS/SVD)** trên server Node.js và **TensorFlow.js** để dự đoán hành vi người dùng trên trình duyệt. Đồng thời xây dựng **hệ thống Đăng ký/Đăng nhập khách hàng** và **tính năng đánh giá tour (1-5 sao)** làm nền tảng dữ liệu cho recommender.

### Phân tích hiện trạng project

| Thành phần | Hiện trạng |
|---|---|
| **Backend** | Express.js + Mongoose + MongoDB |
| **View Engine** | Pug (server-side rendering) |
| **Sản phẩm** | Tour du lịch (`Tour` model) với category, giá, địa điểm, thời gian |
| **Đơn hàng** | `Order` model lưu lịch sử đặt tour |
| **Giỏ hàng** | Xử lý phía client (gửi JSON lên server) |
| **Tài khoản người dùng client** | ❌ **Chưa có** — hiện chỉ có `account-admin` |
| **Đánh giá tour** | ❌ **Chưa có** |
| **Dữ liệu hành vi người dùng** | ❌ **Chưa có** — chưa track view, click, rating |

---

## 📋 Danh Sách Công Việc Theo Thứ Tự

---

### 🔷 Giai Đoạn 1A: Hệ Thống Đăng Ký / Đăng Nhập Khách Hàng (Authentication)

> [!IMPORTANT]
> Giai đoạn này phải làm **đầu tiên** vì mọi tính năng phía sau (rating, tracking, recommendation) đều cần biết "ai là người dùng". Không có auth = không có userId = Collaborative Filtering không hoạt động.

---

#### ✅ Bước 1A.1 — Tạo Model `User` (Tài khoản khách hàng)

**File mới:** `models/user.model.js`

```js
// Schema dự kiến
{
  fullName: String,
  email: { type: String, unique: true },
  password: String,                    // bcrypt hash
  phone: String,
  avatar: String,
  preferences: {                       // sở thích khai báo khi đăng ký (phục vụ Cold Start)
    tourTypes: [String],               // loại tour yêu thích
    budgetRange: { min: Number, max: Number },
    locations: [String]                // địa điểm yêu thích
  },
  status: { type: String, default: "active" },
  tokenUser: String,                   // token xác thực (JWT hoặc random)
  deleted: { type: Boolean, default: false },
  deletedAt: Date
}
// timestamps: true
```

**📌 Lý do:**
- Collaborative Filtering **yêu cầu bắt buộc** có danh tính người dùng (`userId`) để tạo ma trận User-Item
- Trường `preferences` giúp giải quyết **Cold Start Problem** — khi user mới đăng ký, hệ thống dùng sở thích khai báo để đề xuất ngay mà không cần chờ thu thập dữ liệu hành vi
- Tách biệt với `account-admin` hiện có vì khách hàng và admin có quyền hạn khác nhau hoàn toàn

---

#### ✅ Bước 1A.2 — Tạo Model `ForgotPasswordUser` (Quên mật khẩu khách hàng)

**File mới:** `models/forgot-password-user.model.js`

```js
{
  email: String,
  otp: String,
  expireAt: { type: Date, expires: 180 }  // OTP hết hạn sau 3 phút
}
```

**📌 Lý do:** Khách hàng cần có cơ chế khôi phục mật khẩu an toàn. Tách riêng model OTP khỏi User model vì TTL index (`expires`) sẽ tự động xóa document sau khi hết hạn — giữ database sạch. Thiết kế tương tự `forgot-password.model.js` hiện có của admin, đảm bảo nhất quán.

---

#### ✅ Bước 1A.3 — Tạo Auth Controller & Routes cho khách hàng

**File mới:** `controllers/client/auth.controller.js`
**File mới:** `routes/client/auth.route.js`
**File mới:** `validates/client/auth.validate.js`

**Các endpoint:**
```
GET  /auth/register         → Trang đăng ký
POST /auth/register         → Xử lý đăng ký (validate + hash password + tạo user)

GET  /auth/login            → Trang đăng nhập
POST /auth/login            → Xử lý đăng nhập (verify password + set cookie token)

GET  /auth/logout           → Đăng xuất (xóa cookie)

GET  /auth/forgot-password  → Trang quên mật khẩu
POST /auth/forgot-password  → Gửi OTP qua email (dùng nodemailer đã có)

GET  /auth/otp-password     → Trang nhập OTP
POST /auth/otp-password     → Xác thực OTP

GET  /auth/reset-password   → Trang đặt lại mật khẩu
POST /auth/reset-password   → Cập nhật mật khẩu mới

GET  /auth/profile          → Trang thông tin cá nhân (xem + sửa preferences)
PATCH /auth/profile         → Cập nhật thông tin + preferences
```

**📌 Lý do:**
- Đăng ký/đăng nhập là **luồng cơ bản nhất** mà mọi website thương mại cần có
- Sử dụng **cookie-based auth** (set `tokenUser` vào cookie) thay vì session-based vì project đang dùng `cookie-parser` rồi, và cookie tồn tại lâu hơn session (quan trọng cho tracking dài hạn)
- Validate input bằng `Joi` (đã có trong project) để đảm bảo data sạch
- Hash password bằng `bcrypt` (đã có trong project)
- Quên mật khẩu gửi OTP qua `nodemailer` (đã có trong project)
- Trang **Profile** cho phép user chỉnh sửa `preferences` — đây là dữ liệu quý cho Content-Based Filtering

---

#### ✅ Bước 1A.4 — Tạo Auth Middleware (Xác thực khách hàng)

**File mới:** `middlewares/client/auth.middleware.js`

```js
// Luồng xử lý
module.exports.requireAuth = async (req, res, next) => {
  const tokenUser = req.cookies.tokenUser;
  if (!tokenUser) return res.redirect("/auth/login");
  
  const user = await User.findOne({ tokenUser, status: "active", deleted: false });
  if (!user) return res.redirect("/auth/login");
  
  res.locals.user = user;  // truyền user vào tất cả Pug templates
  req.user = user;         // truyền user vào các controller phía sau
  next();
};

module.exports.optionalAuth = async (req, res, next) => {
  // Tương tự nhưng KHÔNG redirect — cho phép anonymous user xem trang
  // Nếu có cookie → gắn user, nếu không → bỏ qua
  next();
};
```

**📌 Lý do:**
- `requireAuth`: Bảo vệ các trang cần đăng nhập (profile, lịch sử đặt tour, rating)
- `optionalAuth`: **Cực kỳ quan trọng cho Recommender** — cho phép hệ thống biết user là ai khi họ browse trang (home, tour detail) mà không bắt buộc phải login. Nếu có userId → track hành vi chính xác, nếu không → track bằng sessionId/cookie
- Gắn `res.locals.user` để Pug template có thể hiển thị tên user, nút login/logout, v.v.

---

#### ✅ Bước 1A.5 — Tạo giao diện Đăng ký / Đăng nhập (Pug templates)

**Files mới:**
- `views/client/pages/auth/register.pug`
- `views/client/pages/auth/login.pug`
- `views/client/pages/auth/forgot-password.pug`
- `views/client/pages/auth/otp-password.pug`
- `views/client/pages/auth/reset-password.pug`
- `views/client/pages/auth/profile.pug`

**📌 Lý do:**
- Giao diện cần thiết để user tương tác với hệ thống auth
- Trang **Register** sẽ có bước bổ sung hỏi `preferences` (loại tour yêu thích, ngân sách, địa điểm) — đây là nguồn dữ liệu ban đầu cho Content-Based Filtering khi user chưa có lịch sử
- Trang **Profile** cho phép user cập nhật sở thích → cải thiện chất lượng recommendation theo thời gian

**Trang Register sẽ có 2 bước:**
```
Bước 1: Thông tin cơ bản (Họ tên, Email, Mật khẩu, SĐT)
Bước 2 (tuỳ chọn): Sở thích cá nhân
  - Loại tour yêu thích: □ Biển đảo □ Núi rừng □ Thành phố □ Văn hoá □ Phiêu lưu
  - Ngân sách: ○ < 2 triệu ○ 2-5 triệu ○ 5-10 triệu ○ > 10 triệu
  - Địa điểm yêu thích: □ Đà Lạt □ Nha Trang □ Phú Quốc □ Hà Nội □ ...
```

---

#### ✅ Bước 1A.6 — Tích hợp Auth vào layout chung & liên kết Order

**Sửa file:** `views/client/layouts/` (header layout)
**Sửa file:** `routes/client/index.route.js`
**Sửa file:** `models/order.model.js` (thêm trường `userId`)

**📌 Lý do:**
- Header cần hiển thị: nút **Đăng nhập/Đăng ký** (khi chưa login) hoặc **Avatar + Tên user + Dropdown** (khi đã login)
- `index.route.js` cần đăng ký route mới `/auth` và áp dụng `optionalAuth` middleware cho các route browse (home, tour, category) để tracking
- `Order` model cần thêm `userId` để liên kết đơn hàng với tài khoản → dữ liệu purchase cho Collaborative Filtering

---

### 🔷 Giai Đoạn 1B: Xây Dựng Nền Tảng Dữ Liệu Hành Vi (Data Foundation)

---

#### ✅ Bước 1B.1 — Tạo Model `UserInteraction` (Thu thập hành vi)

**File mới:** `models/user-interaction.model.js`

```js
// Schema dự kiến
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tourId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tour' },
  type: {
    type: String,
    enum: ["view", "wishlist", "cart_add", "purchase", "rating", "search"]
  },
  value: Number,           // rating (1-5), hoặc thời gian xem (giây), số lần view
  metadata: {
    searchQuery: String,   // từ khóa nếu type = "search"
    viewDuration: Number,  // thời gian xem trang (giây)
    source: String         // nguồn: "home", "category", "search", "recommendation"
  },
  sessionId: String,       // cho anonymous user tracking
  deleted: { type: Boolean, default: false }
}
// timestamps: true → tự động có createdAt, updatedAt
```

**📌 Lý do:** Đây là **nguồn dữ liệu chính** cho toàn bộ hệ thống recommender. Mỗi tương tác được ghi lại sẽ trở thành một "tín hiệu" để thuật toán học hành vi người dùng. Các loại tương tác được đánh trọng số khác nhau:

| Hành vi | Trọng số (Implicit Rating) | Giải thích |
|---|---|---|
| `view` | 1 | Quan tâm nhẹ |
| `wishlist` | 2 | Quan tâm mạnh |
| `cart_add` | 3 | Có ý định mua |
| `rating` | Giá trị thực (1-5) | **Explicit feedback** — nguồn data quý nhất |
| `purchase` | 5 | Hành vi mạnh nhất |

---

#### ✅ Bước 1B.2 — Tạo Model `Review` (Đánh giá tour 1-5 sao) ⭐ MỚI

**File mới:** `models/review.model.js`

```js
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tourId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tour', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },  // 1-5 sao
  title: String,                    // tiêu đề đánh giá (tùy chọn)
  comment: String,                  // nội dung đánh giá
  images: [String],                 // ảnh đánh giá (upload lên Cloudinary)
  travelDate: Date,                 // ngày đi thực tế
  travelType: {                     // loại hình đi
    type: String,
    enum: ["solo", "couple", "family", "friends", "business"]
  },
  isVerifiedPurchase: { type: Boolean, default: false },  // đã mua tour này chưa
  helpfulCount: { type: Number, default: 0 },             // số lượt "hữu ích"
  status: { type: String, default: "active", enum: ["active", "hidden", "pending"] },
  adminReply: {                     // admin phản hồi đánh giá
    content: String,
    repliedAt: Date,
    repliedBy: String
  },
  deleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: String
}
// timestamps: true
// Unique compound index: { userId, tourId } → mỗi user chỉ đánh giá 1 lần/tour
```

**📌 Lý do:**
- **Explicit feedback** (đánh giá có ý thức) là nguồn dữ liệu **chất lượng cao nhất** cho Recommender System. So với implicit feedback (view, click), rating phản ánh chính xác mức độ hài lòng thực sự
- Trường `isVerifiedPurchase` phân biệt đánh giá từ người đã mua vs chưa mua → rating từ verified purchase có trọng số cao hơn trong thuật toán
- Trường `travelType` cung cấp **context** cho Content-Based Filtering (ví dụ: user đi gia đình thường thích tour khác với user đi solo)
- Compound index `{userId, tourId}` đảm bảo 1 user chỉ rate 1 tour 1 lần, tránh spam/manipulation
- Tách `Review` model riêng (không gộp vào `UserInteraction`) vì review có nhiều trường đặc thù (comment, images, reply) và cần query/hiển thị riêng

---

#### ✅ Bước 1B.3 — Tạo Review Controller, Routes & API ⭐ MỚI

**File mới:** `controllers/client/review.controller.js`
**File mới:** `routes/client/review.route.js`

```
POST   /api/review/:tourId        → Tạo đánh giá mới (yêu cầu đăng nhập)
PATCH  /api/review/:reviewId      → Sửa đánh giá của mình
DELETE /api/review/:reviewId      → Xóa đánh giá của mình
GET    /api/review/tour/:tourId   → Lấy danh sách đánh giá của tour (phân trang, sắp xếp)
POST   /api/review/:reviewId/helpful → Đánh dấu "hữu ích"
GET    /api/review/my-reviews     → Lấy tất cả đánh giá của user hiện tại
```

**📌 Lý do:**
- API RESTful cho phép client gọi bằng AJAX — load reviews không cần reload trang
- Phân trang (`?page=1&limit=10`) vì tour phổ biến có thể có hàng trăm đánh giá
- Sắp xếp (`?sort=newest|highest|lowest|helpful`) cho phép user tìm review phù hợp
- Nút "Hữu ích" giúp đẩy review chất lượng lên đầu → cải thiện trải nghiệm
- `my-reviews` cho phép user quản lý đánh giá của mình trong trang Profile

---

#### ✅ Bước 1B.4 — Tạo giao diện Rating & Review UI Component ⭐ MỚI

**File mới:** `views/client/partials/review-section.pug` (component tái sử dụng)
**File mới:** `public/js/review.js` (client-side logic)
**File mới:** `public/css/review.css` (styling)

**UI Component bao gồm:**

```
┌────────────────────────────────────────────────────────┐
│  ⭐ Đánh giá & Nhận xét                               │
│                                                        │
│  ┌──────────────────────┐  ┌────────────────────────┐  │
│  │ Rating tổng hợp      │  │ Phân bố rating         │  │
│  │                      │  │ ★★★★★  ████████░░  65% │  │
│  │     ⭐ 4.3 / 5       │  │ ★★★★☆  ███░░░░░░░  20% │  │
│  │   (128 đánh giá)     │  │ ★★★☆☆  █░░░░░░░░░   8% │  │
│  │                      │  │ ★★☆☆☆  ░░░░░░░░░░   4% │  │
│  └──────────────────────┘  │ ★☆☆☆☆  ░░░░░░░░░░   3% │  │
│                            └────────────────────────┘  │
│                                                        │
│  ┌─ Viết đánh giá ─────────────────────────────────┐   │
│  │ Đánh giá của bạn: ☆ ☆ ☆ ☆ ☆  (click to rate)  │   │
│  │ Tiêu đề: [________________________]             │   │
│  │ Nhận xét: [________________________]            │   │
│  │           [________________________]            │   │
│  │ Loại chuyến đi: ○ Một mình ○ Cặp đôi           │   │
│  │                 ○ Gia đình  ○ Bạn bè            │   │
│  │ 📷 Thêm ảnh: [Chọn ảnh]                        │   │
│  │                         [Gửi đánh giá]          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                        │
│  ── Sắp xếp: [Mới nhất ▼] ──────────────────────────  │
│                                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 👤 Nguyễn Văn A  ★★★★★  ✅ Đã mua tour         │   │
│  │ 📅 15/07/2026 · Đi cùng gia đình               │   │
│  │ "Tour rất tuyệt vời, hướng dẫn viên nhiệt..."  │   │
│  │ 🖼️ [ảnh1] [ảnh2]                                │   │
│  │ 👍 12 người thấy hữu ích                        │   │
│  │                                                 │   │
│  │ 💬 Phản hồi từ đơn vị: "Cảm ơn bạn đã..."      │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

**📌 Lý do:**
- **Rating tổng hợp + biểu đồ phân bố**: Giúp user nhanh chóng đánh giá chất lượng tour tổng thể (giống Google Play Store, Amazon)
- **Star rating interactive**: Click vào sao để rate — UX trực quan, quen thuộc
- **Verified purchase badge** (✅ Đã mua tour): Tăng độ tin cậy → ảnh hưởng quyết định mua → tăng conversion rate
- **Loại chuyến đi**: Dữ liệu `travelType` phục vụ Content-Based Filtering — hệ thống biết user thường đi style nào
- **Upload ảnh**: Review có ảnh được tin tưởng hơn + tạo social proof
- **Mỗi rating submit sẽ tự động tạo 1 record `UserInteraction` type="rating"** → feed trực tiếp vào Recommender engine

---

#### ✅ Bước 1B.5 — Cập nhật Tour model & Tour detail page cho Rating ⭐ MỚI

**Sửa file:** `models/tour.model.js` (thêm trường aggregated rating)
**Sửa file:** `controllers/client/tour.controller.js`
**Sửa file:** `views/client/pages/tour-detail.pug`

```js
// Thêm vào Tour schema
{
  // ... các trường hiện có ...
  ratingAvg: { type: Number, default: 0 },     // điểm trung bình (tính lại khi có review mới)
  ratingCount: { type: Number, default: 0 },    // tổng số đánh giá
  ratingDistribution: {                         // phân bố theo sao
    star1: { type: Number, default: 0 },
    star2: { type: Number, default: 0 },
    star3: { type: Number, default: 0 },
    star4: { type: Number, default: 0 },
    star5: { type: Number, default: 0 }
  }
}
```

**📌 Lý do:**
- **Lưu aggregated rating vào Tour model** (denormalization) thay vì tính lại mỗi lần query vì: trang list tour cần hiển thị rating trung bình, nếu phải aggregate từ Review collection mỗi lần sẽ rất chậm
- `ratingAvg` trở thành **feature quan trọng** cho Content-Based Filtering — tour rating cao → đề xuất nhiều hơn
- `ratingDistribution` phục vụ hiển thị biểu đồ phân bố trên UI

---

#### ✅ Bước 1B.6 — Quản lý Review cho Admin ⭐ MỚI

**File mới:** `controllers/admin/review.controller.js`
**File mới:** `routes/admin/review.route.js`
**File mới:** `views/admin/pages/review-management.pug`

**📌 Lý do:**
- Admin cần khả năng **moderation** — ẩn review vi phạm, reply review, xem thống kê
- Dashboard review cho admin xem: tour nào bị rating thấp, tour nào cần cải thiện
- Phản hồi review (adminReply) tạo tương tác 2 chiều → tăng uy tín

---

#### ✅ Bước 1B.7 — Tạo Middleware thu thập hành vi tự động

**File mới:** `middlewares/client/tracking.middleware.js`

**📌 Lý do:** Thay vì phải sửa từng controller để thêm code tracking, middleware sẽ **tự động** ghi nhận hành vi ở tầng trung gian. Điều này tuân thủ nguyên tắc **Separation of Concerns** — logic tracking tách biệt khỏi logic nghiệp vụ, dễ bảo trì và mở rộng.

**Công việc cụ thể:**
- Track `view` khi user truy cập trang chi tiết tour (`/tour/detail/:slug`)
- Track `cart_add` khi thêm vào giỏ hàng
- Track `purchase` khi đặt hàng thành công
- Track `search` khi tìm kiếm
- Track `rating` khi user submit đánh giá (liên kết với Review)
- Hỗ trợ cả **logged-in user** (dùng userId) và **anonymous user** (dùng sessionId/cookie)

---

#### ✅ Bước 1B.8 — Tạo API endpoint thu thập hành vi phía client

**File mới:** `routes/client/tracking.route.js`
**File mới:** `controllers/client/tracking.controller.js`

```
POST /api/tracking/view      → Ghi nhận xem tour
POST /api/tracking/wishlist   → Ghi nhận thêm wishlist
POST /api/tracking/rating     → Ghi nhận đánh giá (trigger khi submit review)
POST /api/tracking/event      → Ghi nhận sự kiện tổng quát (scroll, hover, duration)
```

**📌 Lý do:** Một số hành vi xảy ra hoàn toàn ở phía client (ví dụ: thời gian xem trang, scroll depth, hover trên tour card). Cần API riêng để client-side JavaScript gửi dữ liệu tracking lên server bằng **AJAX** mà không cần reload trang. Đây cũng là tiền đề để TensorFlow.js ở client gửi dữ liệu về server.

---

### 🔷 Giai Đoạn 2: Xây Dựng Content-Based Filtering Engine

#### ✅ Bước 2.1 — Tạo module trích xuất đặc trưng tour (Feature Extraction)

**File mới:** `services/recommendation/feature-extractor.js`

**📌 Lý do:** Content-Based Filtering hoạt động bằng cách **so sánh đặc trưng giữa các tour với nhau**. Cần chuyển đổi thông tin tour (category, location, price, time, vehicle...) thành **vector số** để tính toán. Đây là bước xây dựng trước vì:
1. **Không phụ thuộc vào dữ liệu người dùng** — có thể hoạt động ngay cả khi chưa có user nào
2. Giải quyết bài toán **Cold Start cho item mới** — tour mới thêm vào vẫn được đề xuất

**Công việc cụ thể:**
- Trích xuất features: `category`, `price range`, `locations`, `duration`, `vehicle type`, `departure season`, **`ratingAvg`** ⭐ (dữ liệu mới từ tính năng đánh giá)
- Chuẩn hóa (normalize) giá về khoảng [0, 1]
- One-hot encoding cho category, vehicle, locations
- Tính **Cosine Similarity** giữa các tour

---

#### ✅ Bước 2.2 — Xây dựng Content-Based Recommender

**File mới:** `services/recommendation/content-based.js`

**📌 Lý do:** Đây là **engine đề xuất đầu tiên** có thể hoạt động ngay lập tức với dữ liệu hiện có. Nó trả lời câu hỏi: *"Tour nào giống với tour mà user đang xem/đã mua?"*

**Thuật toán:**
1. Lấy profile sở thích user (từ `preferences` + lịch sử tương tác + **rating history** ⭐)
2. Tính vector đặc trưng trung bình của các tour user đã thích (Weighted User Profile)
3. So sánh Cosine Similarity với tất cả tour khác
4. Trả về top-N tour tương tự nhất

```
Ví dụ luồng:
User A đã mua: Tour Đà Lạt (3 ngày, xe bus, 2tr) + Tour Nha Trang (4 ngày, xe bus, 2.5tr)
User A đánh giá: Tour Đà Lạt ⭐⭐⭐⭐⭐ (5 sao) → trọng số cao
                 Tour Nha Trang ⭐⭐⭐ (3 sao) → trọng số thấp hơn
→ User Profile Vector thiên về đặc trưng của Tour Đà Lạt
→ Đề xuất: Tour tương tự Đà Lạt hơn Nha Trang
```

---

### 🔷 Giai Đoạn 3: Xây Dựng Collaborative Filtering Engine

#### ✅ Bước 3.1 — Xây dựng ma trận User-Item (Interaction Matrix)

**File mới:** `services/recommendation/matrix-builder.js`

**📌 Lý do:** Collaborative Filtering dựa trên nguyên lý *"Những người có hành vi tương tự trong quá khứ sẽ có sở thích tương tự trong tương lai"*. Ma trận User-Item là **cấu trúc dữ liệu trung tâm** của thuật toán, trong đó:
- Hàng = User
- Cột = Tour
- Giá trị = Rating score (ưu tiên **explicit rating** ⭐ từ review, bổ sung bằng implicit rating từ hành vi)

```
Ma trận User-Item (kết hợp explicit + implicit):
              Tour1  Tour2  Tour3  Tour4  Tour5
User A    [   5★     3⚡     0      0      1⚡  ]     ★ = explicit rating
User B    [   0      4★     0      5★     0    ]     ⚡ = implicit rating
User C    [   3⚡     0      2★     0      4★   ]
User D    [   0      5★     0      3⚡     0    ]

→ User B và User D có pattern tương tự
→ Nếu User D chưa xem Tour2, hệ thống sẽ đề xuất Tour2 cho User D
```

**Công việc cụ thể:**
- Query tất cả `UserInteraction` + **`Review`** ⭐ từ MongoDB
- **Ưu tiên explicit rating** (1-5 sao) khi có, fallback sang implicit rating khi không có
- Xây dựng Sparse Matrix (ma trận thưa) — vì hầu hết user chỉ tương tác với rất ít tour
- Chuẩn hóa ma trận (mean normalization)

---

#### ✅ Bước 3.2 — Triển khai Matrix Factorization (SVD/ALS)

**File mới:** `services/recommendation/matrix-factorization.js`

**📌 Lý do:** Ma trận User-Item thường rất **thưa** (sparse) — hầu hết ô đều bằng 0 vì user chỉ tương tác với vài tour. Matrix Factorization **phân rã** ma trận lớn thành 2 ma trận nhỏ hơn, từ đó **dự đoán** giá trị cho các ô trống (= dự đoán user sẽ thích tour nào).

**Hai thuật toán sẽ triển khai:**

**a) SVD (Singular Value Decomposition):**
```
R ≈ U × Σ × V^T

R (m×n) = Ma trận User-Item gốc
U (m×k) = Ma trận đặc trưng User (latent factors)
Σ (k×k) = Ma trận giá trị riêng (singular values)
V (n×k) = Ma trận đặc trưng Item (latent factors)

k = số latent factors (thường 10-50)
```
- Ưu điểm: Chính xác, có nền tảng toán học vững
- Nhược điểm: Khó xử lý missing values, cần data đầy đủ

**b) ALS (Alternating Least Squares):**
```
R ≈ X × Y^T

Bước 1: Cố định Y, tìm X tối ưu bằng Least Squares
Bước 2: Cố định X, tìm Y tối ưu bằng Least Squares
Lặp lại cho đến khi hội tụ
```
- Ưu điểm: Xử lý tốt **implicit feedback** và **sparse matrix**, phù hợp hơn với project này
- Nhược điểm: Chậm hơn SVD với data nhỏ

**Triển khai bằng thư viện:** `ml-matrix` (cho phép toán ma trận trong Node.js)

---

#### ✅ Bước 3.3 — Tạo Collaborative Filtering Recommender

**File mới:** `services/recommendation/collaborative-filtering.js`

**📌 Lý do:** Sau khi có ma trận factorized, cần module để **truy vấn và trả về kết quả đề xuất**. Module này sẽ:

1. Lấy latent vector của user hiện tại
2. Nhân với ma trận item latent factors
3. Sắp xếp theo predicted rating giảm dần
4. Lọc bỏ tour đã mua/đã xem
5. Trả về top-N recommendations

---

### 🔷 Giai Đoạn 4: Hybrid Recommender — Kết Hợp 2 Engine

#### ✅ Bước 4.1 — Xây dựng Hybrid Recommender Engine

**File mới:** `services/recommendation/hybrid-engine.js`

**📌 Lý do:** Mỗi phương pháp đều có **điểm yếu riêng**:

| Phương pháp | Điểm yếu |
|---|---|
| Content-Based | Chỉ đề xuất tour giống với lịch sử → thiếu đa dạng (filter bubble) |
| Collaborative | Cần nhiều data, không hoạt động với user/tour mới (cold start) |

Hybrid kết hợp **ưu điểm của cả hai**, sử dụng chiến lược **Weighted Hybrid**:

```
Score_final = α × Score_content + β × Score_collaborative + γ × Score_popularity

Trong đó:
- α, β, γ là trọng số (tổng = 1)
- Khi user mới (ít data): α cao, β thấp → ưu tiên Content-Based
- Khi user có nhiều data + nhiều rating: α thấp, β cao → ưu tiên Collaborative
- Score_popularity: tính từ ratingAvg ⭐ + số booking + số lượt xem
```

**Công việc cụ thể:**
- Chuẩn hóa score từ 2 engine về cùng thang đo [0, 1]
- Tự động điều chỉnh trọng số (α, β, γ) dựa trên lượng data + **số lượng rating** ⭐ của user
- Fallback sang popularity-based khi user hoàn toàn mới (cold start)
- Áp dụng business rules: loại tour hết slot, tour đã expired, tour đã bị xóa
- **Boost score cho tour có rating cao** ⭐ (quality signal)

---

#### ✅ Bước 4.2 — Tạo Scheduler để huấn luyện lại model định kỳ

**File mới:** `services/recommendation/training-scheduler.js`

**📌 Lý do:** Matrix Factorization là thuật toán **batch processing** — cần chạy lại trên toàn bộ dữ liệu để cập nhật model. Nếu chỉ train 1 lần, model sẽ lỗi thời khi có user/tour mới. Scheduler sẽ:

- **Chạy re-training** mỗi 6 giờ (hoặc configurable)
- **Cache model** đã train vào bộ nhớ (in-memory) để truy vấn nhanh
- **Log metrics**: RMSE, MAE, precision@K để đánh giá chất lượng model
- Lưu model xuống file JSON để khôi phục khi server restart

---

### 🔷 Giai Đoạn 5: Tích Hợp TensorFlow.js Phía Client (Browser)

#### ✅ Bước 5.1 — Xây dựng module TensorFlow.js phía client

**File mới:** `public/js/recommendation-engine.js`

**📌 Lý do:** TensorFlow.js cho phép chạy mô hình ML **trực tiếp trên trình duyệt** của người dùng, mang lại 3 lợi ích lớn:

1. **Real-time prediction**: Dự đoán ngay lập tức mà không cần gọi API → UX mượt mà
2. **Giảm tải server**: Tính toán nặng được phân bổ sang client
3. **Privacy**: Dữ liệu hành vi có thể xử lý cục bộ trước khi gửi lên server

**Công việc cụ thể:**
- Load pre-trained model (export từ server) vào browser
- Dự đoán hành vi: *"User có khả năng click vào tour X không?"*
- Re-rank kết quả recommendation từ server dựa trên **real-time context** (thời gian trong ngày, thiết bị, hành vi browsing hiện tại)

---

#### ✅ Bước 5.2 — Xây dựng hệ thống thu thập hành vi real-time phía client

**File mới:** `public/js/behavior-tracker.js`

**📌 Lý do:** Nhiều hành vi chỉ xảy ra ở client mà server không biết:

| Hành vi client-side | Ý nghĩa |
|---|---|
| Thời gian xem trang | User đọc kỹ = quan tâm thật |
| Scroll depth | Cuộn hết trang = quan tâm mạnh |
| Mouse hover trên tour card | Phân vân giữa các lựa chọn |
| Click vào ảnh/lịch trình | Đang tìm hiểu sâu |
| **Tương tác với review section** ⭐ | Đọc review = đang cân nhắc mua |

**Công việc cụ thể:**
- Thu thập: page view duration, scroll depth, click events, hover events, **review read time** ⭐
- Batch gửi lên server mỗi 30 giây (hoặc khi rời trang) qua `POST /api/tracking/event`
- Lưu local (localStorage) để tạo session profile cho anonymous user
- Feed dữ liệu vào TensorFlow.js model ở client để real-time prediction

---

#### ✅ Bước 5.3 — Tạo API export model từ server cho client

**File mới:** `controllers/client/recommendation.controller.js` (thêm endpoint)

```
GET /api/recommendation/model    → Download TensorFlow.js model (model.json + weights)
GET /api/recommendation/metadata → Metadata: feature names, normalization params
```

**📌 Lý do:** TensorFlow.js ở browser cần model đã được train ở server. API này phục vụ việc **đồng bộ model** giữa server và client. Model được convert sang format TensorFlow.js (`model.json` + binary weights) để browser tải về và chạy inference.

---

### 🔷 Giai Đoạn 6: Tạo API & Tích Hợp Vào Giao Diện

#### ✅ Bước 6.1 — Tạo Recommendation API endpoints

**File mới:** `routes/client/recommendation.route.js`
**File mới:** `controllers/client/recommendation.controller.js`

```
GET  /api/recommendation/personalized?userId=xxx&limit=10
     → Tour đề xuất cá nhân hóa (Hybrid engine)

GET  /api/recommendation/similar/:tourId?limit=6
     → Tour tương tự với tour đang xem (Content-Based)

GET  /api/recommendation/trending?limit=8
     → Tour đang trending (Popularity-based, weighted by ratingAvg ⭐)

GET  /api/recommendation/top-rated?limit=8          ⭐ MỚI
     → Tour được đánh giá cao nhất

GET  /api/recommendation/category/:categoryId?userId=xxx&limit=8
     → Tour đề xuất trong category cụ thể

POST /api/recommendation/feedback
     → User phản hồi về recommendation (thumbs up/down) để cải thiện model
```

**📌 Lý do:** Tách recommendation thành **API riêng** (không gộp vào controller hiện có) vì:
1. **Tái sử dụng**: Có thể gọi từ nhiều trang (home, detail, category, cart)
2. **Lazy loading**: Trang load nhanh trước, recommendation load sau bằng AJAX
3. **A/B testing**: Dễ thay đổi thuật toán mà không ảnh hưởng giao diện
4. **Caching**: Có thể cache response riêng cho recommendation
5. Endpoint `top-rated` ⭐ tận dụng dữ liệu rating để hiển thị tour chất lượng nhất

---

#### ✅ Bước 6.2 — Tích hợp vào trang Home

**Sửa file:** `controllers/client/home.controller.js`
**Sửa file:** `views/client/pages/home.pug`

**📌 Lý do:** Trang Home là **điểm tiếp xúc đầu tiên** với user, nơi recommendation có tác động lớn nhất. Thêm section mới:

- **"Dành riêng cho bạn"** — Personalized recommendations (nếu đã login)
- **"Tour đang được quan tâm"** — Trending/Popular (cho tất cả user)
- **"Tour được đánh giá cao nhất"** ⭐ — Top-rated tours (social proof mạnh)

---

#### ✅ Bước 6.3 — Tích hợp vào trang Chi tiết Tour

**Sửa file:** `controllers/client/tour.controller.js`
**Sửa file:** `views/client/pages/tour-detail.pug`

**📌 Lý do:** Khi user đang xem chi tiết một tour, đây là **cơ hội tốt nhất** để đề xuất tour tương tự. Thêm section:

- **"Tour tương tự"** — Content-Based (dựa trên tour đang xem)
- **"Khách hàng cũng quan tâm"** — Collaborative Filtering
- **Section Đánh giá & Nhận xét** ⭐ — Review component (từ Bước 1B.4)

---

#### ✅ Bước 6.4 — Tích hợp vào trang Giỏ hàng & Sau Đặt hàng

**Sửa file:** `views/client/pages/cart.pug`
**Sửa file liên quan đến order success page**

**📌 Lý do:** Cross-selling opportunity — *"Bạn có thể thích thêm..."*. Đề xuất tour bổ sung dựa trên tour đã có trong giỏ hàng. Sau khi đặt hàng thành công, **mời user đánh giá tour** ⭐ (sau ngày khởi hành).

---

### 🔷 Giai Đoạn 7: Tối Ưu & Monitoring

#### ✅ Bước 7.1 — Caching layer cho Recommendation

**File mới:** `services/recommendation/cache-manager.js`

**📌 Lý do:** Recommendation engine tính toán nặng. Caching giúp:
- **Giảm latency**: Trả kết quả trong < 50ms thay vì 200-500ms
- **Giảm tải MongoDB**: Không query lại mỗi lần có request
- **Chiến lược cache**: In-memory cache (Map/LRU) với TTL 30 phút, invalidate khi model re-train
- **Cache invalidation khi có review mới** ⭐: Khi user submit rating → invalidate cache của tour đó

---

#### ✅ Bước 7.2 — Dashboard & Metrics cho Admin

**File mới:** `controllers/admin/recommendation.controller.js`
**File mới:** `routes/admin/recommendation.route.js`
**File mới:** `views/admin/pages/recommendation-dashboard.pug`

**📌 Lý do:** Admin cần **đánh giá hiệu quả** hệ thống recommendation:

| Metric | Ý nghĩa |
|---|---|
| CTR (Click-Through Rate) | % user click vào tour được đề xuất |
| Conversion Rate | % user đặt tour từ recommendation |
| Coverage | % tour được recommend ít nhất 1 lần |
| Diversity | Mức đa dạng của recommendations |
| RMSE / MAE | Sai số dự đoán của model |
| **Avg Rating Score** ⭐ | Điểm rating trung bình toàn hệ thống |
| **Review Coverage** ⭐ | % tour đã có ít nhất 1 review |

---

#### ✅ Bước 7.3 — Xử lý Cold Start Problem

**Tích hợp vào:** `services/recommendation/hybrid-engine.js`

**📌 Lý do:** Khi hệ thống mới deploy hoặc user mới đăng ký, chưa có đủ dữ liệu. Chiến lược fallback theo thứ tự ưu tiên:

```
1. User mới + Có preferences khai báo (từ trang đăng ký) → Content-Based từ preferences
2. User mới + Không có preferences     → Tour rating cao nhất ⭐ + Popularity-based
3. Tour mới (chưa ai tương tác)        → Content-Based (so sánh features với tour khác)
4. Hệ thống mới (rất ít data)          → Editorial picks (admin chọn thủ công)
```

---

#### ✅ Bước 7.4 — Tạo Script Generate Fake Data để Test

**File mới:** `scripts/seed-data.js`

**📌 Lý do:** Collaborative Filtering cần **lượng dữ liệu tối thiểu** để hoạt động hiệu quả. Script sẽ tạo:
- 100+ user giả với preferences ngẫu nhiên
- 500+ interaction records (view, cart_add, purchase)
- 200+ reviews ⭐ với rating 1-5 sao ngẫu nhiên (phân bố realistic: nhiều 4-5 sao, ít 1-2 sao)
- Dữ liệu có pattern rõ ràng để verify thuật toán hoạt động đúng

---

## 📦 Thư Viện Cần Cài Đặt

| Thư viện | Mục đích | Giai đoạn |
|---|---|---|
| `@tensorflow/tfjs-node` | Chạy TensorFlow trên server Node.js (train model) | GĐ 3, 5 |
| `@tensorflow/tfjs` | Chạy TensorFlow trên browser (inference) | GĐ 5 |
| `ml-matrix` | Phép toán ma trận (SVD, ALS) trong Node.js | GĐ 3 |
| `node-cron` | Scheduler chạy re-training định kỳ | GĐ 4 |
| `lru-cache` | In-memory LRU cache | GĐ 7 |

> [!NOTE]
> Các thư viện `bcrypt`, `jsonwebtoken`, `cookie-parser`, `nodemailer`, `joi`, `cloudinary`, `multer` đã có sẵn trong project — sẽ tái sử dụng cho Auth và Review upload ảnh.

---

## 📁 Cấu Trúc Thư Mục Mới (Đầy đủ)

```
project1/
├── models/
│   ├── user.model.js                    ← [MỚI] Tài khoản khách hàng
│   ├── forgot-password-user.model.js    ← [MỚI] OTP quên mật khẩu user
│   ├── review.model.js                  ← [MỚI] ⭐ Đánh giá tour 1-5 sao
│   ├── user-interaction.model.js        ← [MỚI] Lưu hành vi người dùng
│   └── tour.model.js                    ← [SỬA] Thêm ratingAvg, ratingCount, ratingDistribution
├── services/
│   └── recommendation/
│       ├── feature-extractor.js         ← [MỚI] Trích xuất đặc trưng tour
│       ├── content-based.js             ← [MỚI] Content-Based engine
│       ├── matrix-builder.js            ← [MỚI] Xây dựng ma trận User-Item
│       ├── matrix-factorization.js      ← [MỚI] SVD/ALS algorithms
│       ├── collaborative-filtering.js   ← [MỚI] Collaborative engine
│       ├── hybrid-engine.js             ← [MỚI] Kết hợp 2 engine
│       ├── training-scheduler.js        ← [MỚI] Scheduler train lại model
│       └── cache-manager.js             ← [MỚI] Cache layer
├── controllers/
│   ├── client/
│   │   ├── auth.controller.js           ← [MỚI] Đăng ký/Đăng nhập
│   │   ├── review.controller.js         ← [MỚI] ⭐ API đánh giá tour
│   │   ├── tracking.controller.js       ← [MỚI] API thu thập hành vi
│   │   └── recommendation.controller.js ← [MỚI] API đề xuất
│   └── admin/
│       ├── review.controller.js         ← [MỚI] ⭐ Quản lý đánh giá
│       └── recommendation.controller.js ← [MỚI] Dashboard admin
├── routes/
│   ├── client/
│   │   ├── auth.route.js                ← [MỚI] Routes đăng ký/đăng nhập
│   │   ├── review.route.js              ← [MỚI] ⭐ Routes đánh giá
│   │   ├── tracking.route.js            ← [MỚI]
│   │   └── recommendation.route.js      ← [MỚI]
│   └── admin/
│       ├── review.route.js              ← [MỚI] ⭐ Routes quản lý review
│       └── recommendation.route.js      ← [MỚI]
├── validates/
│   └── client/
│       └── auth.validate.js             ← [MỚI] Validate đăng ký/đăng nhập
├── middlewares/
│   └── client/
│       ├── auth.middleware.js            ← [MỚI] Xác thực user (requireAuth, optionalAuth)
│       └── tracking.middleware.js        ← [MỚI] Auto-tracking
├── public/
│   ├── js/
│   │   ├── recommendation-engine.js     ← [MỚI] TensorFlow.js client
│   │   ├── behavior-tracker.js          ← [MỚI] Thu thập hành vi client
│   │   └── review.js                    ← [MỚI] ⭐ Client-side review logic
│   └── css/
│       └── review.css                   ← [MỚI] ⭐ Review component styling
├── views/
│   ├── client/
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── register.pug         ← [MỚI] Trang đăng ký
│   │   │   │   ├── login.pug            ← [MỚI] Trang đăng nhập
│   │   │   │   ├── forgot-password.pug  ← [MỚI] Trang quên mật khẩu
│   │   │   │   ├── otp-password.pug     ← [MỚI] Trang nhập OTP
│   │   │   │   ├── reset-password.pug   ← [MỚI] Trang đặt lại mật khẩu
│   │   │   │   └── profile.pug          ← [MỚI] Trang thông tin cá nhân
│   │   │   ├── home.pug                 ← [SỬA] Thêm section đề xuất + top rated
│   │   │   └── tour-detail.pug          ← [SỬA] Thêm tour tương tự + review section
│   │   └── partials/
│   │       └── review-section.pug       ← [MỚI] ⭐ Component đánh giá (tái sử dụng)
│   └── admin/pages/
│       ├── recommendation-dashboard.pug ← [MỚI] Dashboard metrics
│       └── review-management.pug        ← [MỚI] ⭐ Quản lý đánh giá
├── scripts/
│   └── seed-data.js                     ← [MỚI] Script tạo fake data để test
└── models/
    └── order.model.js                   ← [SỬA] Thêm trường userId
```

---

## ⏱ Ước Tính Thời Gian

| Giai đoạn | Công việc | Thời gian |
|---|---|---|
| **GĐ 1A** | Đăng ký/Đăng nhập khách hàng (Auth) | 3-4 ngày |
| **GĐ 1B** | Nền tảng dữ liệu (Interaction model, **Rating/Review ⭐**, Tracking) | 3-4 ngày |
| **GĐ 2** | Content-Based Filtering | 2-3 ngày |
| **GĐ 3** | Collaborative Filtering + Matrix Factorization | 3-4 ngày |
| **GĐ 4** | Hybrid Engine + Scheduler | 2-3 ngày |
| **GĐ 5** | TensorFlow.js client-side | 3-4 ngày |
| **GĐ 6** | API + Tích hợp giao diện | 2-3 ngày |
| **GĐ 7** | Caching + Monitoring + Cold Start + Seed Data | 2-3 ngày |
| **Tổng** | | **~20-28 ngày** |

---

## Open Questions

> [!NOTE]
> **Quy mô dữ liệu:** Hiện tại project có khoảng bao nhiêu tour và dự kiến bao nhiêu user? Điều này ảnh hưởng đến việc chọn thuật toán và chiến lược caching.
