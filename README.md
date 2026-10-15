# Virtual Study Room — Nền tảng phòng học nhóm trực tuyến

Đồ án môn học: phòng học nhóm trực tuyến (Virtual Study Room).

## Cấu trúc repository

```
qldapm/
├── backend/                     # Node.js + Express + Socket.io + MongoDB
│   ├── server.js                # Entry: Express + HTTP + Socket.io
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── config/db.js
│       ├── controllers/
│       ├── middlewares/
│       ├── models/
│       ├── routes/
│       └── sockets/
└── frontend/                    # Next.js App Router + TailwindCSS
    ├── app/
    ├── components/
    │   ├── ui/
    │   ├── room/
    │   └── dashboard/
    ├── lib/
    │   ├── api.js
    │   └── socket.js
    ├── .env.local.example
    └── package.json
```

## Tech stack

| Phần     | Công nghệ                                                         | Deploy |
|----------|-------------------------------------------------------------------|--------|
| Backend  | Express, Mongoose, Socket.io, JWT, bcryptjs, cors, dotenv         | Render |
| Frontend | Next.js (App Router), TailwindCSS, Lucide-react, socket.io-client | Vercel |

## Cài đặt ban đầu

Yêu cầu: **Node.js ≥ 18**, tài khoản **MongoDB Atlas**.

### 1. Backend

```bash
cd backend
cp .env.example .env
```

Mở `.env`, điền:

- `MONGO_URI` — connection string Atlas
- `JWT_SECRET` — chuỗi bí mật dài (≥ 32 ký tự)
- `CLIENT_URL=http://localhost:3000`
- `PORT=5000`

```bash
npm install
npm run dev
```

API chạy tại http://localhost:5000 — kiểm tra `GET /api/health`.

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

App chạy tại http://localhost:3000.

`NEXT_PUBLIC_API_URL` và `NEXT_PUBLIC_SOCKET_URL` trong `.env.local` trỏ về backend local (đã có sẵn trong file example).

## API đã có sẵn (khung)

| Method | Path                 | Mô tả                                      |
|--------|----------------------|--------------------------------------------|
| GET    | `/api/health`        | Health check                               |
| POST   | `/api/auth/register` | Đăng ký (validate email/password/name)     |
| POST   | `/api/auth/login`    | Đăng nhập (validate email/password)        |
| GET    | `/api/auth/me`       | Profile (cần JWT)                          |
| PUT    | `/api/auth/profile`  | Cập nhật name/avatar (cần JWT)             |
| GET    | `/api/rooms`         | Danh sách phòng công khai                  |
| POST   | `/api/rooms`         | Tạo phòng (cần JWT)                        |
| GET    | `/api/rooms/:id`     | Chi tiết phòng                             |

Socket.io đã gắn vào HTTP server; handler trong `backend/src/sockets/index.js` sẵn sàng mở rộng.
