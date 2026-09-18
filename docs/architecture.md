# Phase 2 架构

## 运行边界

```text
Vue Dashboard (web) -- /api 代理 --> Hono Worker (worker，8788)
      |                                      |
      +--> Manifest + Service Worker          +--> D1（Project、API Key、Message、Subscription、Delivery）
                                             +--> NotificationChannel --> WebPushChannel
```

Web 与 Worker 独立开发、独立构建。共享 API 响应、错误码和领域类型通过 `@notification-hub/shared` 提供，应用包不得直接读取另一个应用包的源码。

## 迭代顺序

1. Phase 3：Dashboard 完整页面、消息详情、深色模式与响应式优化。
2. Phase 4：Queue、投递重试、Delivery Logs 与失效订阅清理。
3. 后续阶段：Heartbeat 与 SDK。

## 安全基线

- Worker 健康检查不访问数据库，以保证基础运行可独立验证。
- 项目 API Key、VAPID 私钥和 Cloudflare 凭据均不可写入代码、日志或版本库。
- 管理 Dashboard 鉴权尚未实现，公网开放前必须补齐。
- Message 的写入以 Project API Key 鉴权；Key 仅保存 SHA-256 哈希，明文只在创建响应中出现一次。
- D1 是消息事实源：Message 写入成功后才在 `waitUntil` 中异步投递；推送失败只记录 Delivery，不影响 API 写入结果。
- VAPID 公钥通过专用 API 提供给浏览器；私钥、主体与 Cloudflare 凭据只可由 Secret 或本地 gitignore 文件提供。
