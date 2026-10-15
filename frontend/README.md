# Frontend — Virtual Study Room

## Cấu trúc thư mục

```
frontend/
├── .env.local.example
├── .eslintrc.json
├── .gitignore
├── jsconfig.json
├── next.config.mjs
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── app/
│   ├── globals.css
│   ├── layout.js
│   ├── page.js                 # Landing
│   ├── login/page.js
│   ├── register/page.js
│   ├── dashboard/page.js
│   └── room/[id]/page.js
├── components/
│   ├── ui/                     # Button, Input, Badge
│   ├── dashboard/              # RoomCard, CreateRoomForm
│   └── room/                   # RoomHeader, MemberList, ChatPanel
└── lib/
    ├── api.js                  # REST client
    └── socket.js               # Socket.io client
```

## Cài đặt

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Mở http://localhost:3000
