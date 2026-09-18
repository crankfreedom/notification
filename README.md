# Notification Hub

面向开发者的轻量级个人通知中心与项目运行监控平台。外部项目将运行状态、任务结果或异常发送至 HTTP API；平台持久化消息，并通过 PWA Web Push 发送提醒。

## 当前进度

已完成 Phase 2：Phase 1 的项目与消息主链路，以及 PWA Manifest、Service Worker、Push Subscription、VAPID 和 Web Push 投递。

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

也可分别运行 `pnpm dev:web`、`pnpm dev:worker`。本地 Worker 使用 Wrangler 的本地 D1 模拟数据库；首次运行或新增迁移后执行 `pnpm db:migrate:local`。

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

## Phase 2：PWA 与 Web Push

Worker 使用标准 Web Push 协议。生成一次 VAPID 密钥后，生产环境通过 Cloudflare Secret 写入；私钥绝不能提交、输出或放到前端。

```bash
pnpm --filter @notification-hub/worker exec web-push generate-vapid-keys
pnpm --filter @notification-hub/worker exec wrangler secret put VAPID_PUBLIC_KEY
pnpm --filter @notification-hub/worker exec wrangler secret put VAPID_PRIVATE_KEY
pnpm --filter @notification-hub/worker exec wrangler secret put VAPID_SUBJECT
```

部署到 HTTPS 域名后，访问 Dashboard 的 Settings 页面并开启通知。前端会获取公钥、注册 Service Worker、创建浏览器订阅并提交至 `POST /api/v1/push/subscriptions`；每次 `POST /api/v1/messages` 写入成功后，Worker 会异步投递至启用订阅。订阅 API 还包括 `GET /api/v1/push/subscriptions`、`DELETE /api/v1/push/subscriptions/:id` 和 `GET /api/v1/push/vapid-public-key`。

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

VAPID 私钥、项目 API Key 等敏感信息仅能通过 `wrangler secret put` 或 gitignore 的本地凭据文件配置，禁止写进仓库、`.env.example` 或日志。当前管理 API 尚无 Dashboard 鉴权，禁止直接公网开放。

## 许可证说明

`bark-worker-master/` 是独立的 GPL-3.0 参考项目。不要将其中的实现复制到本项目；如需复用，须先确认许可证义务。
