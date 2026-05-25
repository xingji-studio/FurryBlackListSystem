# FurryBlackListSystem

福瑞联合净网行动，极端福瑞/反福瑞行为档案库。

## 本地开发

### 初始化环境

```bash
cp apps/api/.env.example apps/api/.env
bun install
bun run init:api
```

默认会在 `apps/api/blacklist.db` 初始化本地数据库。

### 启动服务

分别打开 3 个终端执行：

```bash
bun run dev:api
bun run dev:public
bun run dev:admin
```

## 环境变量

后端环境变量示例见 `apps/api/.env.example`。

## Serverless 部署

### 创建数据库

- 去 Turso 官网控制台手动创建数据库
- 在控制台复制数据库连接地址和 `auth token`

### 创建后端

- 在 Vercel 创建一个项目，选 Github 仓库
- 填入必要的环境变量，包括 `DATABASE_URL` 和 `DATABASE_AUTH_TOKEN` 等

### 创建前端

- 分别单独部署 `apps/public` 和 `apps/admin` 即可
