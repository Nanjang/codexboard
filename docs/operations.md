# Operations Guide

## 1. Infrastructure
```bash
docker compose up -d
```

## 2. Environment
- Copy root `.env.example` to `.env` for web env vars.
- Copy `apps/api/.env.example` to `apps/api/.env` and update secrets.

## 3. Install
```bash
npm install
```

## 4. Prisma
```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed --workspace @codexboard/api
```

## 5. Run
```bash
npm run dev
```

## 6. Health Checks
- Web: `http://localhost:3000`
- API: `http://localhost:4000/bbs/board?bo_table=free`

## 7. Notes
- Session: `HttpOnly cookie + Redis`
- Upload root defaults to `uploads`
- Board defaults:
  - admin account: `admin`
  - seeded password: `admin1234!` (change immediately)
