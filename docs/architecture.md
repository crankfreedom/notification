# Phase 1 架构

## 运行边界

```text
Vue Dashboard (web) -- /api 代理 --> Hono Worker (worker，8788)
                                             |
                                             +--> D1（Project、API Key、Message）
                                             +--> Web Push（Phase 2）
```

Web 与 Worker 独立开发、独立构建。共享 API 响应、错误码和领域类型通过 `@notification-hub/shared` 提供，应用包不得直接读取另一个应用包的源码。

## 迭代顺序

1. Phase 2：PWA manifest、Service Worker、订阅管理与 Web Push。
2. 后续阶段：Dashboard 完整页面、Queue/Delivery、Heartbeat 与 SDK。

## 安全基线

- Worker 健康检查不访问数据库，以保证基础运行可独立验证。
- 项目 API Key、VAPID 私钥和 Cloudflare 凭据均不可写入代码、日志或版本库。
- 管理 Dashboard 鉴权尚未实现，公网开放前必须补齐。
- Message 的写入以 Project API Key 鉴权；Key 仅保存 SHA-256 哈希，明文只在创建响应中出现一次。
- D1 是消息事实源；本阶段不发送 Push，Phase 2 的通知逻辑将以 Message 持久化成功为前置条件。
