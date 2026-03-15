# Hướng dẫn tích hợp thanh toán ZaloPay

## Mục lục
- [Tổng quan](#tổng-quan)
- [Yêu cầu](#yêu-cầu)
- [Bước 1: Cài đặt ngrok](#bước-1-cài-đặt-ngrok)
- [Bước 2: Khởi chạy ngrok](#bước-2-khởi-chạy-ngrok)
- [Bước 3: Cấu hình biến môi trường](#bước-3-cấu-hình-biến-môi-trường)
- [Bước 4: Khởi chạy server](#bước-4-khởi-chạy-server)
- [Bước 5: Test thanh toán ZaloPay](#bước-5-test-thanh-toán-zalopay)
- [Luồng thanh toán](#luồng-thanh-toán)
- [Giải thích các endpoint](#giải-thích-các-endpoint)
- [Xử lý lỗi thường gặp](#xử-lý-lỗi-thường-gặp)
- [Tài khoản test ZaloPay Sandbox](#tài-khoản-test-zalopay-sandbox)

---

## Tổng quan

Hệ thống sử dụng **ZaloPay Sandbox** để test thanh toán. ZaloPay yêu cầu một URL công khai (public URL) để gửi callback xác nhận thanh toán (IPN - Instant Payment Notification). Vì server chạy trên localhost, chúng ta cần **ngrok** để tạo tunnel public URL.

### Luồng thanh toán tổng quan:

```
Người dùng chọn ZaloPay → Server tạo đơn ZaloPay → Redirect đến trang thanh toán ZaloPay
→ Người dùng thanh toán → ZaloPay gọi callback (IPN) đến server → Server cập nhật trạng thái
→ ZaloPay redirect người dùng về trang thành công
```

---

## Yêu cầu

- **Node.js** >= 18
- **yarn** hoặc **npm**
- **ngrok** (miễn phí) - [https://ngrok.com](https://ngrok.com)
- Tài khoản ngrok (đăng ký miễn phí)

---

## Bước 1: Cài đặt ngrok

### Cách 1: Tải từ trang chủ
1. Truy cập [https://ngrok.com/download](https://ngrok.com/download)
2. Tải phiên bản phù hợp với hệ điều hành
3. Giải nén và thêm vào PATH

### Cách 2: Cài qua npm (khuyên dùng)
```bash
npm install -g ngrok
```

### Cách 3: Cài qua Homebrew (macOS)
```bash
brew install ngrok
```

### Cách 4: Cài qua Chocolatey (Windows)
```bash
choco install ngrok
```

### Đăng ký và xác thực ngrok
1. Đăng ký tài khoản miễn phí tại [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
2. Lấy authtoken tại [https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Chạy lệnh xác thực:
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

---

## Bước 2: Khởi chạy ngrok

Mở **terminal riêng** (không đóng terminal này) và chạy:

```bash
ngrok http 3000
```

Kết quả sẽ hiển thị tương tự:

```
Session Status    online
Forwarding        https://xxxx-xxxx-xxxx.ngrok-free.app -> http://localhost:3000

Connections       ttl     opn     rt1     rt5     p50     p90
                  0       0       0.00    0.00    0.00    0.00
```

> **Quan trọng:** Copy URL `https://xxxx-xxxx-xxxx.ngrok-free.app` - đây là URL public của bạn.

> **Lưu ý:** URL ngrok sẽ thay đổi mỗi lần khởi chạy lại (phiên bản miễn phí). Bạn cần cập nhật lại `.env` mỗi lần URL thay đổi.

---

## Bước 3: Cấu hình biến môi trường

Mở file `.env` và thêm/cập nhật các biến sau:

```env
# ZaloPay Sandbox Configuration
ZALOPAY_APP_ID=554
ZALOPAY_KEY1=8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn
ZALOPAY_KEY2=trMrHtvjo6myautxDUiAcYsVtaeQ8nhf
ZALOPAY_ENDPOINT=https://sb-openapi.zalopay.vn/v2/create

# Thay YOUR_NGROK_URL bằng URL ngrok ở Bước 2
ZALOPAY_CALLBACK_URL=https://YOUR_NGROK_URL.ngrok-free.app/order/zalopay-callback
BASE_URL=https://YOUR_NGROK_URL.ngrok-free.app
```

### Ví dụ cụ thể:
Nếu ngrok hiển thị URL là `https://a1b2-103-45-67-89.ngrok-free.app`, thì `.env` sẽ là:

```env
ZALOPAY_CALLBACK_URL=https://a1b2-103-45-67-89.ngrok-free.app/order/zalopay-callback
BASE_URL=https://a1b2-103-45-67-89.ngrok-free.app
```

### Giải thích các biến:

| Biến | Mô tả |
|------|--------|
| `ZALOPAY_APP_ID` | App ID của ZaloPay (Sandbox: `554`) |
| `ZALOPAY_KEY1` | Key 1 dùng để tạo chữ ký khi gửi request tạo đơn |
| `ZALOPAY_KEY2` | Key 2 dùng để xác minh callback từ ZaloPay |
| `ZALOPAY_ENDPOINT` | API endpoint tạo đơn thanh toán |
| `ZALOPAY_CALLBACK_URL` | URL mà ZaloPay sẽ gọi để thông báo kết quả thanh toán (server-to-server) |
| `BASE_URL` | URL gốc của website, dùng để tạo redirect URL cho người dùng |

---

## Bước 4: Khởi chạy server

```bash
yarn start
# hoặc
npm start
```

Server sẽ chạy tại `http://localhost:3000`.

> **Quan trọng:** Truy cập website qua **URL ngrok** (ví dụ: `https://a1b2-103-45-67-89.ngrok-free.app`) thay vì `http://localhost:3000` để đảm bảo redirect hoạt động đúng.

---

## Bước 5: Test thanh toán ZaloPay

1. Truy cập website qua URL ngrok
2. Chọn tour và thêm vào giỏ hàng
3. Vào giỏ hàng, điền thông tin khách hàng
4. Chọn phương thức thanh toán **"Ví ZaloPay"**
5. Nhấn **"Đặt hàng"**
6. Hệ thống sẽ redirect sang trang thanh toán ZaloPay
7. Sử dụng tài khoản test để thanh toán (xem mục [Tài khoản test](#tài-khoản-test-zalopay-sandbox))
8. Sau khi thanh toán thành công, ZaloPay sẽ:
   - Gọi callback đến server để cập nhật trạng thái đơn hàng thành `"paid"`
   - Redirect người dùng về trang đặt hàng thành công

---

## Luồng thanh toán

### Sơ đồ luồng chi tiết:

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client   │     │  Server  │     │  ZaloPay  │     │  Server  │
│ (Browser) │     │ (Express)│     │   API     │     │ Callback │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1. POST        │                │                │
     │ /order/create  │                │                │
     │───────────────>│                │                │
     │                │                │                │
     │ 2. orderId     │                │                │
     │<───────────────│                │                │
     │                │                │                │
     │ 3. GET /order/ │                │                │
     │ payment-zalopay│                │                │
     │───────────────>│                │                │
     │                │ 4. POST create │                │
     │                │ order          │                │
     │                │───────────────>│                │
     │                │                │                │
     │                │ 5. order_url   │                │
     │                │<───────────────│                │
     │                │                │                │
     │ 6. Redirect    │                │                │
     │ to ZaloPay     │                │                │
     │<───────────────│                │                │
     │                │                │                │
     │ 7. User pays   │                │                │
     │───────────────────────────────>│                │
     │                │                │                │
     │                │                │ 8. POST        │
     │                │                │ callback (IPN) │
     │                │                │───────────────>│
     │                │                │                │
     │                │                │ 9. Update      │
     │                │                │ paymentStatus  │
     │                │                │ = "paid"       │
     │                │                │<───────────────│
     │                │                │                │
     │ 10. Redirect   │                │                │
     │ to return URL  │                │                │
     │<───────────────────────────────│                │
     │                │                │                │
     │ 11. GET /order/│                │                │
     │ zalopay-return │                │                │
     │───────────────>│                │                │
     │                │                │                │
     │ 12. Redirect   │                │                │
     │ to /order/     │                │                │
     │ success        │                │                │
     │<───────────────│                │                │
     │                │                │                │
     │ 13. Order      │                │                │
     │ success page   │                │                │
     │<───────────────│                │                │
```

### Giải thích từng bước:

1. **Client gửi POST /order/create** - Tạo đơn hàng với `paymentMethod: "zalopay"`
2. **Server trả về orderId** - Đơn hàng được tạo với `paymentStatus: "unpaid"`
3. **Client redirect đến /order/payment-zalopay/:orderId** - Bắt đầu quy trình thanh toán
4. **Server gọi ZaloPay API** - Gửi thông tin đơn hàng lên ZaloPay, bao gồm `callback_url` và `redirecturl`
5. **ZaloPay trả về order_url** - URL trang thanh toán ZaloPay
6. **Server redirect người dùng đến trang thanh toán ZaloPay**
7. **Người dùng thanh toán trên ZaloPay**
8. **ZaloPay gọi callback (IPN)** - Server-to-server, gọi POST đến `/order/zalopay-callback`
9. **Server xác minh và cập nhật** - Kiểm tra chữ ký HMAC, cập nhật `paymentStatus` thành `"paid"`
10. **ZaloPay redirect người dùng** - Về `redirecturl` đã cung cấp
11. **Client truy cập /order/zalopay-return** - Xử lý redirect trung gian
12. **Server redirect đến /order/success** - Chuyển đến trang thành công với đầy đủ thông tin
13. **Hiển thị trang đặt hàng thành công**

---

## Giải thích các endpoint

### 1. `GET /order/payment-zalopay/:orderId`
- **Chức năng:** Tạo giao dịch ZaloPay và redirect người dùng đến trang thanh toán
- **Flow:** Tìm đơn hàng → Tạo request ZaloPay → Redirect đến order_url

### 2. `POST /order/zalopay-callback`
- **Chức năng:** Nhận callback từ ZaloPay (server-to-server) khi thanh toán hoàn tất
- **Flow:** Xác minh chữ ký HMAC (key2) → Parse embed_data → Cập nhật paymentStatus = "paid"
- **Quan trọng:** Endpoint này **phải** được truy cập từ internet (ngrok)

### 3. `GET /order/zalopay-return`
- **Chức năng:** Xử lý redirect khi người dùng quay lại từ ZaloPay
- **Flow:** Lấy orderId → Tìm đơn hàng → Redirect đến trang success

---

## Xử lý lỗi thường gặp

### Lỗi: "Không thể tạo giao dịch ZaloPay"
- **Nguyên nhân:** Sai `ZALOPAY_APP_ID` hoặc `ZALOPAY_KEY1`
- **Cách sửa:** Kiểm tra lại các biến trong `.env`. Sandbox dùng:
  - `ZALOPAY_APP_ID=554`
  - `ZALOPAY_KEY1=8NdU5pG5R2spGHGhyO99HN1OhD8IQJBn`

### Lỗi: Thanh toán xong nhưng trạng thái vẫn "unpaid"
- **Nguyên nhân:** ZaloPay không gọi được callback vì URL không public
- **Cách sửa:**
  1. Kiểm tra ngrok đang chạy
  2. Kiểm tra `ZALOPAY_CALLBACK_URL` trong `.env` trỏ đúng URL ngrok
  3. Restart server sau khi thay đổi `.env`

### Lỗi: Redirect về trang trắng hoặc lỗi 404 sau thanh toán
- **Nguyên nhân:** `BASE_URL` không đúng hoặc ngrok đã hết hạn
- **Cách sửa:**
  1. Kiểm tra `BASE_URL` trong `.env` trỏ đúng URL ngrok
  2. Nếu ngrok đã restart, cập nhật lại cả `ZALOPAY_CALLBACK_URL` và `BASE_URL`

### Lỗi: "mac not equal" trong log callback
- **Nguyên nhân:** Sai `ZALOPAY_KEY2`
- **Cách sửa:** Kiểm tra `ZALOPAY_KEY2=trMrHtvjo6myautxDUiAcYsVtaeQ8nhf` trong `.env`

### Lỗi: Số tiền = 0 hoặc không tạo được đơn
- **Nguyên nhân:** Đơn hàng chưa tính tổng tiền hoặc `total = 0`
- **Cách sửa:** Kiểm tra giỏ hàng có sản phẩm và giá hợp lệ

---

## Tài khoản test ZaloPay Sandbox

Khi thanh toán trên trang ZaloPay Sandbox, sử dụng thông tin test sau:

### Thẻ ATM test:
| Thông tin | Giá trị |
|-----------|---------|
| Ngân hàng | Chọn bất kỳ ngân hàng nào |
| Số thẻ | `9704 0000 0000 0018` |
| Tên chủ thẻ | `NGUYEN VAN A` |
| Ngày phát hành | `03/07` |
| OTP | `otp` |

> **Lưu ý:** Đây là thông tin test, chỉ hoạt động trên môi trường Sandbox.

---

## Checklist nhanh khi bắt đầu dev

- [ ] Đã cài ngrok và đăng ký tài khoản
- [ ] Đã chạy `ngrok http 3000` trên terminal riêng
- [ ] Đã copy URL ngrok (dạng `https://xxxx.ngrok-free.app`)
- [ ] Đã cập nhật `ZALOPAY_CALLBACK_URL` trong `.env` với URL ngrok
- [ ] Đã cập nhật `BASE_URL` trong `.env` với URL ngrok
- [ ] Đã cấu hình đầy đủ `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2` trong `.env`
- [ ] Đã restart server sau khi thay đổi `.env`
- [ ] Truy cập website qua URL ngrok (không phải localhost)
