# Backend — Virtual Study Room

## Cấu trúc thư mục

```
backend/
├── .env.example
├── .gitignore
├── package.json
├── server.js                 # Entry point: Express + HTTP + Socket.io
└── src/
    ├── config/
    │   └── db.js             # Kết nối MongoDB (Mongoose)
    ├── controllers/
    │   ├── authController.js
    │   └── roomController.js
    ├── middlewares/
    │   ├── authMiddleware.js # JWT protect
    │   └── errorMiddleware.js
    ├── models/
    │   ├── User.js
    │   └── Room.js
    ├── routes/
    │   ├── authRoutes.js
    │   └── index.js          # Room routes
    └── sockets/
        └── index.js          # Socket.io handlers (khung sẵn sàng)
```

## Cài đặt

```bash
cd backend
cp .env.example .env
# Chỉnh MONGO_URI, JWT_SECRET, CLIENT_URL trong .env
npm install
npm run dev
```

- `npm run dev` — chạy với `node --watch` (tự reload khi sửa code)
- `npm start` — chạy production (`node server.js`)

API health: `GET http://localhost:5000/api/health`
