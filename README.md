# Notification Hub

面向开发者的轻量级个人通知中心与项目运行监控平台。外部项目将运行状态、任务结果或异常发送至 HTTP API；平台持久化消息，并在后续阶段通过 PWA Web Push 发送提醒。

## 当前进度

已完成 Phase 1：D1 核心表、Project CRUD、一次性签发的 Project API Key、鉴权消息写入和消息历史页。Web Push 将在 Phase 2 实现。

## 目录

```text
notification/
├── web/                     # Vue 3 Dashboard
├── worker/                  # Hono API，部署到 Cloudflare Workers
├── packages/
│   └── shared/              # 共享类型、响应与错误码
├── migrations/              # D1 迁移（Phase 1 起）
├── docs/                    # 架构文档
├── bark-worker-master/      # 仅供参考的第三方 Bark Worker，不参与构建
└── prompt.txt               # 产品规格
```

## 本地开发

要求：Node.js 22+ 与 pnpm 11+。

```bash
pnpm install
pnpm dev
```

- Web：`http://localhost:5173`
- Worker：`http://localhost:8788`
- 健康检查：`http://localhost:8788/api/v1/health`

也可分别运行 `pnpm dev:web`、`pnpm dev:worker`。本地 Worker 使用 Wrangler 的本地 D1 模拟数据库；Phase 1 创建迁移后，可执行 `pnpm db:migrate:local`。

## Phase 1 API 快速验证

先启动 Worker 并执行本地迁移，然后创建项目与 API Key。创建 Key 的响应中 `apiKey` 只会返回一次，应立即保存在安全的调用方配置中。

```bash
curl -X POST http://127.0.0.1:8788/api/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Stock System","slug":"stock-system"}'

curl -X POST http://127.0.0.1:8788/api/v1/projects/<projectId>/api-keys

curl -X POST http://127.0.0.1:8788/api/v1/messages \
  -H "Authorization: Bearer push_xxx" \
  -H "Content-Type: application/json" \
  -d '{"level":"error","title":"Crawler failed","message":"Request timeout"}'
```

可通过 `GET /api/v1/messages` 查看历史，支持 `project`、`level`、`keyword`、`page` 与 `pageSize` 查询参数；Dashboard 的 `/messages` 页面显示同一列表。

## 质量检查

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

## Cloudflare 配置与部署

`worker/wrangler.jsonc` 已预留 `NOTIFICATION_DB` D1 绑定。部署前请创建 D1 数据库，使用真实 `database_id` 替换配置中的占位 UUID，再执行：

```bash
pnpm --filter @notification-hub/worker deploy
```

VAPID 私钥、项目 API Key 等敏感信息仅能通过 `wrangler secret put` 配置，禁止写进仓库或 `.env.example`。当前管理 API 尚无 Dashboard 鉴权，禁止直接公网开放；PWA 安装与 Web Push 将在 Phase 2 实现。

## 许可证说明

`bark-worker-master/` 是独立的 GPL-3.0 参考项目。不要将其中的实现复制到本项目；如需复用，须先确认许可证义务。
