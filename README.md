# 🌍 Hệ Thống Quản Lý & Đặt Tour Du Lịch

## 📋 Giới Thiệu

Dự án **Hệ Thống Quản Lý & Đặt Tour Du Lịch** là một ứng dụng web full-stack được xây dựng trên nền tảng Node.js/Express, sử dụng MongoDB làm cơ sở dữ liệu và Pug làm template engine. Hệ thống bao gồm hai phần chính:

- **Trang quản trị (Admin):** Quản lý tour, danh mục, đơn hàng, người dùng, phân quyền và cài đặt hệ thống.
- **Trang khách hàng (Client):** Duyệt tour, tìm kiếm, quản lý giỏ hàng, đặt tour và gửi liên hệ.

## 🛠️ Công Nghệ Sử Dụng

| Công nghệ | Mô tả |
|---|---|
| **Node.js + Express** | Backend framework |
| **MongoDB + Mongoose** | Cơ sở dữ liệu NoSQL |
| **Pug** | Template engine |
| **JWT** | Xác thực token |
| **Bcrypt** | Mã hóa mật khẩu |
| **Cloudinary** | Lưu trữ hình ảnh đám mây |
| **Nodemailer** | Gửi email (OTP, thông báo) |
| **Joi** | Validate dữ liệu |
| **Multer** | Upload file |

## ✅ Chức Năng Hiện Tại

### Trang Quản Trị
- Quản lý tour (CRUD, xóa mềm, khôi phục, lọc nâng cao)
- Quản lý danh mục phân cấp (cha - con)
- Quản lý đơn hàng, liên hệ, người dùng
- Hệ thống phân quyền RBAC (Role-Based Access Control)
- Đăng nhập, quên mật khẩu qua OTP
- Dashboard tổng quan

### Trang Khách Hàng
- Duyệt tour theo danh mục
- Tìm kiếm tour
- Giỏ hàng, đặt hàng
- Gửi liên hệ

---

## 🚀 Đề Xuất Chức Năng Nâng Cao (Advanced Features)

### 1. 🤖 Gợi Ý Tour Thông Minh (AI-Based Recommendation System)

**Độ khó:** ⭐⭐⭐⭐⭐

**Mô tả:**
Xây dựng hệ thống gợi ý tour dựa trên thuật toán **Collaborative Filtering** và **Content-Based Filtering**. Hệ thống phân tích hành vi người dùng (lịch sử xem, đặt tour, thời gian ở trang) kết hợp với đặc điểm tour (địa điểm, giá, loại hình) để đề xuất các tour phù hợp nhất cho từng người dùng.

**Chi tiết kỹ thuật:**
- Thu thập dữ liệu hành vi người dùng (view history, click events, booking history) lưu vào collection riêng
- Áp dụng thuật toán **Cosine Similarity** để tính độ tương đồng giữa các người dùng và tour
- Sử dụng **TF-IDF** để phân tích nội dung mô tả tour, trích xuất đặc trưng
- Kết hợp **Hybrid Recommendation** (collaborative + content-based) để tăng độ chính xác
- Hiển thị "Tour gợi ý cho bạn" trên trang chủ và trang chi tiết tour
- Cập nhật mô hình gợi ý theo thời gian thực khi có dữ liệu mới

**Công nghệ bổ sung:** `brain.js` hoặc `tensorflow.js` cho mô hình ML phía server

---

### 2. 💳 Tích Hợp Thanh Toán Trực Tuyến (Online Payment Gateway)

**Độ khó:** ⭐⭐⭐⭐

**Mô tả:**
Tích hợp các cổng thanh toán phổ biến tại Việt Nam như **VNPay**, **MoMo**, **ZaloPay** để khách hàng có thể thanh toán trực tuyến khi đặt tour. Hệ thống xử lý callback thanh toán, xác nhận giao dịch tự động và cập nhật trạng thái đơn hàng real-time.

**Chi tiết kỹ thuật:**
- Tích hợp VNPay Payment Gateway API với mã hóa HMAC-SHA512
- Xử lý IPN (Instant Payment Notification) callback từ cổng thanh toán
- Implement **idempotency** để tránh xử lý trùng giao dịch
- Quản lý trạng thái thanh toán: pending → processing → success/failed → refunded
- Hỗ trợ hoàn tiền (refund) khi hủy đơn
- Lưu log giao dịch chi tiết để đối soát
- Tự động gửi email xác nhận thanh toán thành công

---

### 3. 💬 Chat Thời Gian Thực & Chatbot Hỗ Trợ (Real-time Chat & AI Chatbot)

**Độ khó:** ⭐⭐⭐⭐⭐

**Mô tả:**
Xây dựng hệ thống chat real-time giữa khách hàng và nhân viên tư vấn sử dụng **Socket.io**. Kết hợp **Chatbot AI** sử dụng xử lý ngôn ngữ tự nhiên (NLP) để tự động trả lời các câu hỏi thường gặp về tour, giá cả, lịch trình trước khi chuyển đến nhân viên.

**Chi tiết kỹ thuật:**
- Sử dụng **Socket.io** cho giao tiếp WebSocket hai chiều
- Xây dựng chatbot với **intent classification** để nhận diện ý định người dùng (hỏi giá, hỏi lịch trình, đặt tour, khiếu nại...)
- Training chatbot với dữ liệu FAQ của hệ thống tour
- Implement **conversation context** để chatbot nhớ ngữ cảnh cuộc hội thoại
- Hệ thống xếp hàng chờ (queue) khi chuyển đến nhân viên tư vấn
- Lưu lịch sử chat và phân tích thống kê (thời gian phản hồi, độ hài lòng)
- Thông báo real-time cho admin khi có khách hàng cần hỗ trợ

**Công nghệ bổ sung:** `socket.io`, `natural` (NLP library cho Node.js)

---

### 4. 📊 Dashboard Phân Tích Dữ Liệu Nâng Cao (Advanced Analytics Dashboard)

**Độ khó:** ⭐⭐⭐⭐

**Mô tả:**
Xây dựng dashboard phân tích dữ liệu nâng cao với biểu đồ trực quan, bao gồm phân tích doanh thu, xu hướng đặt tour, phân tích hành vi người dùng và dự đoán doanh thu tương lai sử dụng **Time Series Forecasting**.

**Chi tiết kỹ thuật:**
- Sử dụng **MongoDB Aggregation Pipeline** để tổng hợp dữ liệu phức tạp
- Biểu đồ doanh thu theo ngày/tuần/tháng/quý/năm (line chart, bar chart)
- Phân tích tour bán chạy nhất, danh mục phổ biến nhất (pie chart, heatmap)
- **Cohort Analysis**: Phân tích tỷ lệ khách hàng quay lại theo nhóm thời gian
- **Funnel Analysis**: Phân tích chuyển đổi từ xem tour → thêm giỏ hàng → đặt hàng → thanh toán
- Dự đoán doanh thu bằng thuật toán **ARIMA** hoặc **Exponential Smoothing**
- Export báo cáo ra PDF/Excel
- Gửi báo cáo tự động qua email theo lịch (cron job)

**Công nghệ bổ sung:** `chart.js`, `pdfkit`, `exceljs`, `node-cron`

---

### 5. 🗺️ Tích Hợp Bản Đồ & Lộ Trình Tour (Interactive Map & Route Planning)

**Độ khó:** ⭐⭐⭐⭐

**Mô tả:**
Tích hợp **Google Maps API** hoặc **Mapbox** để hiển thị bản đồ tương tác trên trang chi tiết tour. Khách hàng có thể xem lộ trình tour trên bản đồ, các điểm dừng chân, khoảng cách giữa các điểm và thời gian di chuyển ước tính.

**Chi tiết kỹ thuật:**
- Hiển thị bản đồ tương tác với các marker cho từng điểm đến trong tour
- Vẽ đường đi (route) giữa các điểm với **Directions API**
- Tính toán tổng khoảng cách và thời gian di chuyển
- **Geofencing**: Gợi ý tour theo vị trí hiện tại của người dùng (Geolocation API)
- **Clustering**: Nhóm các tour cùng khu vực trên bản đồ tổng quan
- Street View 360° cho các điểm đến nổi bật
- Hỗ trợ offline map cho ứng dụng mobile (Progressive Web App)

**Công nghệ bổ sung:** `@googlemaps/js-api-loader` hoặc `mapbox-gl`, `@turf/turf` (geospatial analysis)

---

### 6. ⭐ Hệ Thống Đánh Giá & Phân Tích Cảm Xúc (Review System with Sentiment Analysis)

**Độ khó:** ⭐⭐⭐⭐⭐

**Mô tả:**
Xây dựng hệ thống đánh giá tour với xếp hạng sao và bình luận. Áp dụng **Sentiment Analysis** (phân tích cảm xúc) bằng NLP để tự động phân loại đánh giá thành tích cực/tiêu cực/trung lập, phát hiện đánh giá spam/giả và tạo tóm tắt đánh giá tự động.

**Chi tiết kỹ thuật:**
- Hệ thống rating 1-5 sao với bình luận chi tiết
- Upload hình ảnh đánh giá (ảnh thực tế từ chuyến đi)
- **Sentiment Analysis** sử dụng mô hình NLP để phân tích cảm xúc đánh giá
- **Spam Detection**: Phát hiện đánh giá giả/spam dựa trên pattern matching và ML
- **Auto-summarization**: Tự động tóm tắt các đánh giá nổi bật (ưu/nhược điểm)
- Hệ thống vote hữu ích (helpful/not helpful) cho đánh giá
- Hiển thị điểm trung bình và phân bổ rating trên trang tour
- Admin có thể phản hồi đánh giá

**Công nghệ bổ sung:** `sentiment` (sentiment analysis), `natural` (NLP toolkit), `compromise` (NLP)

---

### 7. 🔄 Định Giá Động Theo Thuật Toán (Dynamic Pricing Algorithm)

**Độ khó:** ⭐⭐⭐⭐⭐

**Mô tả:**
Implement hệ thống **định giá động** tự động điều chỉnh giá tour dựa trên nhiều yếu tố: mức độ nhu cầu, số chỗ còn lại, thời điểm trong năm (mùa cao/thấp điểm), lịch sử đặt hàng và giá đối thủ. Sử dụng thuật toán tối ưu hóa để tìm mức giá cân bằng giữa doanh thu và tỷ lệ lấp đầy.

**Chi tiết kỹ thuật:**
- Thu thập và phân tích dữ liệu demand theo thời gian (time-series data)
- Áp dụng **Price Elasticity Model** để tính độ nhạy giá theo từng phân khúc khách hàng
- **Yield Management Algorithm**: Tối ưu doanh thu dựa trên tỷ lệ lấp đầy chỗ
- Rule engine cho các quy tắc giá: early bird discount, last-minute deal, group discount
- **A/B Testing** giá để đo lường hiệu quả các chiến lược giá khác nhau
- Hiển thị biến động giá cho khách hàng (giá có thể tăng, nên đặt sớm)
- Cảnh báo admin khi giá thay đổi bất thường
- Dashboard theo dõi hiệu quả chiến lược giá

---

### 8. 🔐 Xác Thực Đa Yếu Tố & OAuth2 (Multi-Factor Authentication & Social Login)

**Độ khó:** ⭐⭐⭐⭐

**Mô tả:**
Nâng cấp hệ thống xác thực với **Multi-Factor Authentication (MFA)** sử dụng TOTP (Time-based One-Time Password) qua Google Authenticator và tích hợp **OAuth2** để đăng nhập qua Google, Facebook. Implement **refresh token rotation** để tăng cường bảo mật session.

**Chi tiết kỹ thuật:**
- Tích hợp **Passport.js** với chiến lược Google OAuth2 và Facebook OAuth2
- Implement **TOTP** (RFC 6238) cho xác thực 2 bước qua Google Authenticator
- Hỗ trợ backup codes khi mất thiết bị xác thực
- **Refresh Token Rotation**: Tự động xoay refresh token sau mỗi lần sử dụng
- **Device fingerprinting**: Nhận diện thiết bị đăng nhập, cảnh báo thiết bị lạ
- Rate limiting cho login attempts (chống brute force)
- Session management: Xem và thu hồi các phiên đăng nhập đang hoạt động
- Audit log: Ghi lại mọi hoạt động xác thực

**Công nghệ bổ sung:** `passport`, `passport-google-oauth20`, `speakeasy` (TOTP), `qrcode`

---

### 9. ⚡ Hệ Thống Cache & Tối Ưu Hiệu Năng (Redis Caching & Performance Optimization)

**Độ khó:** ⭐⭐⭐⭐

**Mô tả:**
Tích hợp **Redis** làm lớp cache để tối ưu hiệu năng hệ thống. Implement các chiến lược cache thông minh cho dữ liệu tour, danh mục, session, và hàng đợi xử lý tác vụ nặng (email, resize ảnh) bằng **Bull Queue**.

**Chi tiết kỹ thuật:**
- **Cache-Aside Pattern**: Cache kết quả truy vấn tour, danh mục (TTL tùy chỉnh)
- **Cache Invalidation**: Tự động xóa cache khi dữ liệu thay đổi (write-through)
- **Session Store**: Lưu session vào Redis thay vì memory (hỗ trợ scale ngang)
- **Rate Limiter**: Giới hạn request bằng Redis (sliding window algorithm)
- **Bull Queue**: Hàng đợi xử lý tác vụ nặng (gửi email, resize/optimize ảnh, generate report)
- **Redis Pub/Sub**: Real-time notification giữa các instance server
- Monitoring cache hit/miss ratio qua dashboard
- Benchmark trước/sau khi áp dụng cache

**Công nghệ bổ sung:** `ioredis`, `bull`, `connect-redis`

---

### 10. 📱 Progressive Web App & Push Notification

**Độ khó:** ⭐⭐⭐⭐

**Mô tả:**
Chuyển đổi ứng dụng thành **Progressive Web App (PWA)** với khả năng hoạt động offline, cài đặt trên màn hình chính và nhận **Push Notification** về trạng thái đơn hàng, tour mới, khuyến mãi.

**Chi tiết kỹ thuật:**
- **Service Worker**: Cache tài nguyên tĩnh và API responses cho offline access
- **Web App Manifest**: Cho phép cài đặt ứng dụng lên màn hình chính
- **Push Notification** (Web Push API + VAPID):
  - Thông báo trạng thái đơn hàng (xác nhận, đang xử lý, hoàn thành)
  - Thông báo tour mới theo sở thích
  - Nhắc nhở lịch khởi hành sắp tới
  - Thông báo khuyến mãi/giảm giá
- **Background Sync**: Đồng bộ đơn hàng khi khôi phục kết nối mạng
- **IndexedDB**: Lưu trữ dữ liệu offline trên trình duyệt
- Lighthouse audit đạt điểm PWA > 90

**Công nghệ bổ sung:** `web-push`, `workbox`

---

## 📊 Ma Trận Đánh Giá Chức Năng Nâng Cao

| # | Chức Năng | Độ Khó | Giá Trị Học Thuật | Ấn Tượng | Công Nghệ Mới |
|---|-----------|--------|-------------------|----------|----------------|
| 1 | Gợi ý Tour AI | ⭐⭐⭐⭐⭐ | Rất cao | 🔥🔥🔥 | ML, NLP |
| 2 | Thanh toán trực tuyến | ⭐⭐⭐⭐ | Cao | 🔥🔥🔥 | Payment API |
| 3 | Chat & Chatbot AI | ⭐⭐⭐⭐⭐ | Rất cao | 🔥🔥🔥 | WebSocket, NLP |
| 4 | Analytics Dashboard | ⭐⭐⭐⭐ | Cao | 🔥🔥 | Aggregation, Chart |
| 5 | Bản đồ tương tác | ⭐⭐⭐⭐ | Cao | 🔥🔥🔥 | Maps API |
| 6 | Đánh giá & Sentiment | ⭐⭐⭐⭐⭐ | Rất cao | 🔥🔥🔥 | NLP, ML |
| 7 | Định giá động | ⭐⭐⭐⭐⭐ | Rất cao | 🔥🔥🔥 | Algorithm |
| 8 | MFA & OAuth2 | ⭐⭐⭐⭐ | Cao | 🔥🔥 | Security |
| 9 | Redis Cache & Queue | ⭐⭐⭐⭐ | Cao | 🔥🔥 | Redis, Bull |
| 10 | PWA & Push Notification | ⭐⭐⭐⭐ | Cao | 🔥🔥 | Service Worker |

> **Gợi ý ưu tiên:** Nên triển khai chức năng **1 (Gợi ý Tour AI)**, **3 (Chat & Chatbot)** và **7 (Định giá động)** vì đây là các chức năng có giá trị học thuật cao nhất, thể hiện kiến thức về thuật toán và trí tuệ nhân tạo — những chủ đề được đánh giá cao trong đồ án.

---

## ⚙️ Cài Đặt & Chạy Dự Án

```bash
# Clone repository
git clone <repository-url>

# Cài đặt dependencies
yarn install

# Tạo file .env từ .env.example
cp .env.example .env
# Cập nhật các biến môi trường trong file .env

# Chạy ở chế độ development
yarn dev

# Chạy ở chế độ production
yarn start
```

## 📁 Cấu Trúc Thư Mục

```
Project-Backend/
├── config/             # Cấu hình database, biến, phân quyền
├── controllers/        # Xử lý logic nghiệp vụ
│   ├── admin/          # Controllers trang quản trị
│   └── client/         # Controllers trang khách hàng
├── helpers/            # Hàm tiện ích (cloudinary, mail, generate)
├── middlewares/        # Middleware xác thực, phân quyền
│   ├── admin/
│   └── client/
├── models/             # Schema MongoDB (Mongoose)
├── public/             # Tài nguyên tĩnh (CSS, JS, images)
├── routes/             # Định tuyến URL
│   ├── admin/
│   └── client/
├── validates/          # Validate dữ liệu đầu vào (Joi)
├── views/              # Template Pug
│   ├── admin/
│   └── client/
├── index.js            # Entry point
├── package.json
└── README.md
```
