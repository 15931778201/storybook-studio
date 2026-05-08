# 儿童绘本阅读器 MVP

## 结构
- `apps/api` Node.js + Express + TypeScript 后端
- `apps/reader-web` Vue3 + Vite 前端
- `packages/shared-types` 前后端共享类型

## 快速开始
1. 安装依赖：`npm install`
2. 启动 MySQL（默认连接 `127.0.0.1:3306/storybook_mvp`）
3. 启动后端：`npm run dev:api`
4. 启动前端：`npm run dev:web`

## 默认管理员
- 用户名：`admin`
- 密码：`admin123456`

可通过 `apps/api/.env` 覆盖：
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `JWT_SECRET`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

## MVP 主要接口
- `POST /api/admin/login`
- `POST /api/admin/books/import`
- `GET /api/admin/books`
- `PATCH /api/admin/books/:id/publish`
- `PATCH /api/admin/books/:id/unpublish`
- `GET /api/books`
- `GET /api/books/:id`
- `POST /api/reading/events/batch`
- `GET /api/health`
- `POST /api/ai/*` (占位)
