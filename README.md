# 28.TRAVEL - Tour Booking and Recommendation Platform

28.TRAVEL is a full-stack travel booking application built with Node.js,
Express, MongoDB, and Pug. The project includes a customer website, an admin
dashboard, online payment flows, behavior tracking, and a hybrid tour
recommendation system with TensorFlow.js re-ranking in the browser.

Production demo: <https://project-backend-plum.vercel.app>

## Main Features

### Customer website

- Browse, search, and filter domestic and international tours.
- Register, log in, update a profile, and recover a forgotten password by OTP.
- Save favorite tours and manage a shopping cart.
- Create orders and pay by cash, bank transfer, ZaloPay, or VNPay.
- View order history, notifications, vouchers, and submitted reviews.
- Receive personalized, similar, trending, and top-rated tour recommendations.

### Admin dashboard

- Manage tours, categories, articles, users, roles, and permissions.
- Manage orders, reviews, vouchers, contacts, notifications, and website settings.
- Upload images through Cloudinary.
- Monitor sales and recommendation metrics such as CTR, conversion, RMSE,
  Precision@K, cache performance, and the last model training time.

### Recommendation system

The recommendation pipeline combines several strategies:

1. **Content-Based Filtering** compares tour features such as category, price,
   duration, vehicle, departure season, average rating, and rating count.
2. **Collaborative Filtering** builds a sparse user-tour matrix and trains an
   ALS or truncated SVD matrix-factorization model.
3. **Popularity Ranking** combines ratings, favorites, purchases, and views.
4. **Hybrid Ranking** changes the Content, Collaborative, and Popularity
   weights based on how much data is available for each user.
5. **TensorFlow.js** re-ranks server candidates in the browser using the time
   of day, device type, current session behavior, popularity, and rating.

Recommendation feedback uses the following signals:

| Signal | Meaning |
|---|---|
| View | Weak positive interest |
| Favorite | Positive interest |
| Recommendation click | Positive interest, weight `2.5` |
| Add to cart | Strong positive interest |
| Purchase | Completed interaction; the tour is no longer recommended |
| Rating 1-2 | Negative preference |
| Rating 3 | Neutral preference |
| Rating 4-5 | Positive preference |
| Recommendation ignore | Negative contextual feedback |

The model is retrained every six hours or after the configured interaction
threshold is reached. The trained artifact is persisted to
`data/recommendation-model.json` and restored when the application starts.

## Technology Stack

| Area | Technologies |
|---|---|
| Backend | Node.js, Express 5 |
| Database | MongoDB, Mongoose |
| Server-rendered UI | Pug, CSS, Tailwind CSS, DaisyUI |
| Client JavaScript | Vanilla JavaScript, Swiper, AOS, Viewer.js, Notyf |
| Recommendation | Content-Based Filtering, Collaborative Filtering, ALS, SVD, TensorFlow.js |
| Authentication | JWT, Express Session, bcrypt, cookies |
| Validation | Joi |
| Caching | LRU Cache |
| File upload | Multer, Cloudinary |
| Email and OTP | Nodemailer |
| Payments | ZaloPay Sandbox, VNPay Sandbox |
| Testing | Node.js test runner, strict assertions, TensorFlow.js integration tests |
| Deployment | Vercel Serverless Functions |

## Project Structure

```text
api/                         Vercel serverless entrypoint
config/                      Database and application configuration
controllers/                 Customer and admin request handlers
data/                        Static data and persisted recommendation artifact
docs/                        Implementation and test coverage documentation
helpers/                     Shared business helpers
middlewares/                 Authentication, authorization, and tracking
models/                      Mongoose schemas
public/                      CSS, browser JavaScript, and images
routes/                      Customer and admin routes
scripts/                     Maintenance and seed scripts
services/recommendation/     Recommendation algorithms and scheduler
tests/                       Automated tests
validates/                   Joi request validation
views/                       Pug templates
index.js                     Express application entrypoint
vercel.json                  Vercel configuration
```

## Requirements

- Node.js 24 or a compatible current Node.js release.
- Yarn 1.x.
- MongoDB local instance or MongoDB Atlas database.
- Cloudinary credentials when image upload is required.
- SMTP credentials when email and OTP flows are required.
- ZaloPay/VNPay sandbox credentials when testing online payments.

## Installation

```powershell
git clone https://github.com/23521228-BuiLeHuyPhuoc/Project-Backend.git
cd Project-Backend
yarn install
Copy-Item .env.example .env
```

Update `.env` with your local credentials. The most important variables are:

```dotenv
DATABASE=mongodb-connection-string
JWT_SECRET=long-random-secret
SESSION_SECRET=long-random-secret
COOKIE_SECRET=long-random-secret
BASE_URL=http://localhost:3000
```

Cloudinary, email, ZaloPay, VNPay, and recommendation scheduler variables are
documented in `.env.example`.

Start the development server:

```powershell
yarn start
```

The application is available at <http://localhost:3000>.

## Mock Login Account

The repository does not commit a shared production password or automatically
insert login accounts into every database. Use the following safe local/demo
credential:

| Field | Value |
|---|---|
| Login URL | `http://localhost:3000/auth/login` |
| Email | `demo.user@28travel.local` |
| Password | `Demo@123456` |
| Role | Customer |

Create the account once on the registration page at
<http://localhost:3000/auth/register>, using:

```text
Full name: Demo User
Email: demo.user@28travel.local
Phone: 0900000000
Password: Demo@123456
Confirm password: Demo@123456
```

Alternatively, create it through the registration API in PowerShell:

```powershell
$body = @{
  fullName = "Demo User"
  email = "demo.user@28travel.local"
  phone = "0900000000"
  password = "Demo@123456"
  confirmPassword = "Demo@123456"
  tourTypes = @("beach", "culture")
  budgetRange = "2-5"
  locations = @("da-nang", "nha-trang")
  agree = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3000/auth/register" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

The admin login URL is `http://localhost:3000/admin/account/login`. No default
admin password is committed because admin accounts require a valid role and
permission assignment. Create an admin account through a controlled database
or existing authorized admin account instead of sharing production credentials.

> Never reuse the mock password for a real or production account.

## Available Scripts

```powershell
yarn start                  # Start the application with Nodemon
yarn test                   # Run the complete automated test suite
yarn seed:vouchers          # Insert or update promotion vouchers
yarn sync:tour-ratings      # Recalculate tour rating aggregates
```

Run recommendation tests with coverage:

```powershell
node --test --experimental-test-coverage
```

The recommendation test matrix is documented in
`docs/recommendation-test-coverage.md`.

## Main Recommendation APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/recommendation/personalized` | Hybrid recommendations for the current user |
| GET | `/api/recommendation/similar/:tourId` | Tours similar to a source tour |
| GET | `/api/recommendation/trending` | Popular and trending tours |
| GET | `/api/recommendation/top-rated` | Highest-rated available tours |
| POST | `/api/recommendation/feedback` | Store recommendation click or ignore feedback |
| GET | `/api/recommendation/model` | TensorFlow.js model manifest |
| GET | `/api/recommendation/model/weights.bin` | TensorFlow.js model weights |
| GET | `/api/recommendation/metadata` | Feature and model metadata |

## Security Notes

- Do not commit `.env`, `.env.local`, database credentials, API keys, or real
  login passwords.
- Use separate secrets for local, preview, and production environments.
- Rotate any credential that has accidentally been committed or shared.
- The mock credential in this README is intended only for local/demo data.

## License

This project is licensed under the MIT License.
