import {
  API_PREFIX,
  createMessageSchema,
  createPushSubscriptionSchema,
  createProjectSchema,
  failure,
  success,
  updateProjectSchema,
} from '@notification-hub/shared';
import { Hono } from 'hono';
import { WebPushChannel, type NotificationMessage } from './notifications';

type Bindings = {
  NOTIFICATION_DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};
type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
type MessageRow = {
  id: string;
  project_id: string;
  project_name: string;
  project_slug: string;
  level: string;
  title: string;
  message: string;
  url: string | null;
  tags: string | null;
  metadata: string | null;
  dedupe_key: string | null;
  created_at: string;
};
type PushSubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

const app = new Hono<{ Bindings: Bindings }>();
const encoder = new TextEncoder();
const publicId = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
const toHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const hashKey = async (key: string) =>
  toHex(await crypto.subtle.digest('SHA-256', encoder.encode(key)));
const parseJson = <T>(value: string | null): T | undefined =>
  value ? (JSON.parse(value) as T) : undefined;
const projectDto = (row: ProjectRow) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description ?? undefined,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const messageDto = (row: MessageRow) => ({
  id: row.id,
  project: { id: row.project_id, name: row.project_name, slug: row.project_slug },
  level: row.level,
  title: row.title,
  message: row.message,
  url: row.url ?? undefined,
  tags: parseJson<string[]>(row.tags),
  metadata: parseJson<Record<string, unknown>>(row.metadata),
  dedupeKey: row.dedupe_key ?? undefined,
  createdAt: row.created_at,
});
const invalid = (message: string) => failure('INVALID_REQUEST', message);
const subscriptionDto = (row: {
  id: string;
  endpoint: string;
  enabled: number;
  expiration_time: number | null;
  created_at: string;
  updated_at: string;
}) => ({
  id: row.id,
  endpoint: row.endpoint,
  enabled: Boolean(row.enabled),
  expirationTime: row.expiration_time ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const deliverMessage = async (
  database: D1Database,
  env: Bindings,
  message: NotificationMessage,
) => {
  const { results } = await database
    .prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE enabled = 1')
    .all<PushSubscriptionRow>();
  const channel = new WebPushChannel(env);
  await Promise.all(
    (results ?? []).map(async (subscription) => {
      const result = await channel.send(message, subscription);
      await database.batch([
        database
          .prepare(
            'INSERT INTO notification_deliveries (id, message_id, channel, subscription_id, status, error) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .bind(
            publicId('delivery'),
            message.id,
            'web_push',
            subscription.id,
            result.status,
            result.error ?? null,
          ),
        ...(result.status === 'expired'
          ? [
              database
                .prepare(
                  'UPDATE push_subscriptions SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                )
                .bind(subscription.id),
            ]
          : []),
      ]);
    }),
  );
};

app.get(`${API_PREFIX}/health`, (context) => context.json({ status: 'ok', timestamp: Date.now() }));
app.get(`${API_PREFIX}/projects`, async (context) => {
  const { results } = await context.env.NOTIFICATION_DB.prepare(
    'SELECT * FROM projects ORDER BY created_at DESC',
  ).all<ProjectRow>();
  return context.json(success((results ?? []).map(projectDto)));
});
app.post(`${API_PREFIX}/projects`, async (context) => {
  const input = createProjectSchema.safeParse(await context.req.json().catch(() => null));
  if (!input.success)
    return context.json(invalid(input.error.issues[0]?.message ?? '请求体无效'), 400);
  const id = publicId('project');
  try {
    await context.env.NOTIFICATION_DB.prepare(
      'INSERT INTO projects (id, name, slug, description) VALUES (?, ?, ?, ?)',
    )
      .bind(id, input.data.name, input.data.slug, input.data.description ?? null)
      .run();
  } catch {
    return context.json(invalid('项目 slug 已存在。'), 409);
  }
  const row = await context.env.NOTIFICATION_DB.prepare('SELECT * FROM projects WHERE id = ?')
    .bind(id)
    .first<ProjectRow>();
  return context.json(success(projectDto(row!)), 201);
});
app.get(`${API_PREFIX}/projects/:id`, async (context) => {
  const row = await context.env.NOTIFICATION_DB.prepare('SELECT * FROM projects WHERE id = ?')
    .bind(context.req.param('id'))
    .first<ProjectRow>();
  return row
    ? context.json(success(projectDto(row)))
    : context.json(failure('PROJECT_NOT_FOUND', 'Project not found.'), 404);
});
app.patch(`${API_PREFIX}/projects/:id`, async (context) => {
  const input = updateProjectSchema.safeParse(await context.req.json().catch(() => null));
  if (!input.success)
    return context.json(invalid(input.error.issues[0]?.message ?? '请求体无效'), 400);
  const current = await context.env.NOTIFICATION_DB.prepare('SELECT * FROM projects WHERE id = ?')
    .bind(context.req.param('id'))
    .first<ProjectRow>();
  if (!current) return context.json(failure('PROJECT_NOT_FOUND', 'Project not found.'), 404);
  const next = {
    name: input.data.name ?? current.name,
    slug: input.data.slug ?? current.slug,
    description: input.data.description ?? current.description,
  };
  try {
    await context.env.NOTIFICATION_DB.prepare(
      'UPDATE projects SET name = ?, slug = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    )
      .bind(next.name, next.slug, next.description, current.id)
      .run();
  } catch {
    return context.json(invalid('项目 slug 已存在。'), 409);
  }
  const row = await context.env.NOTIFICATION_DB.prepare('SELECT * FROM projects WHERE id = ?')
    .bind(current.id)
    .first<ProjectRow>();
  return context.json(success(projectDto(row!)));
});
app.delete(`${API_PREFIX}/projects/:id`, async (context) => {
  const result = await context.env.NOTIFICATION_DB.prepare('DELETE FROM projects WHERE id = ?')
    .bind(context.req.param('id'))
    .run();
  return result.meta.changes
    ? context.body(null, 204)
    : context.json(failure('PROJECT_NOT_FOUND', 'Project not found.'), 404);
});
app.post(`${API_PREFIX}/projects/:id/api-keys`, async (context) => {
  const projectId = context.req.param('id');
  if (
    !(await context.env.NOTIFICATION_DB.prepare('SELECT id FROM projects WHERE id = ?')
      .bind(projectId)
      .first())
  )
    return context.json(failure('PROJECT_NOT_FOUND', 'Project not found.'), 404);
  const rawKey = `push_${crypto.randomUUID().replaceAll('-', '')}`;
  const id = publicId('key');
  await context.env.NOTIFICATION_DB.prepare(
    'INSERT INTO project_api_keys (id, project_id, key_prefix, key_hash) VALUES (?, ?, ?, ?)',
  )
    .bind(id, projectId, rawKey.slice(0, 13), await hashKey(rawKey))
    .run();
  return context.json(success({ id, keyPrefix: rawKey.slice(0, 13), apiKey: rawKey }), 201);
});
app.get(`${API_PREFIX}/projects/:id/api-keys`, async (context) => {
  const { results } = await context.env.NOTIFICATION_DB.prepare(
    'SELECT id, key_prefix, enabled, last_used_at, created_at FROM project_api_keys WHERE project_id = ? ORDER BY created_at DESC',
  )
    .bind(context.req.param('id'))
    .all<{
      id: string;
      key_prefix: string;
      enabled: number;
      last_used_at: string | null;
      created_at: string;
    }>();
  return context.json(
    success(
      (results ?? []).map((row) => ({
        id: row.id,
        keyPrefix: row.key_prefix,
        enabled: Boolean(row.enabled),
        lastUsedAt: row.last_used_at ?? undefined,
        createdAt: row.created_at,
      })),
    ),
  );
});
app.delete(`${API_PREFIX}/projects/:id/api-keys/:keyId`, async (context) => {
  const result = await context.env.NOTIFICATION_DB.prepare(
    'DELETE FROM project_api_keys WHERE id = ? AND project_id = ?',
  )
    .bind(context.req.param('keyId'), context.req.param('id'))
    .run();
  return result.meta.changes
    ? context.body(null, 204)
    : context.json(failure('INVALID_REQUEST', 'API key not found.'), 404);
});
app.get(`${API_PREFIX}/push/vapid-public-key`, (context) => {
  const publicKey = context.env.VAPID_PUBLIC_KEY;
  return publicKey
    ? context.json(success({ publicKey }))
    : context.json(failure('PUSH_FAILED', 'Web Push is not configured.'), 503);
});
app.get(`${API_PREFIX}/push/subscriptions`, async (context) => {
  const { results } = await context.env.NOTIFICATION_DB.prepare(
    'SELECT id, endpoint, enabled, expiration_time, created_at, updated_at FROM push_subscriptions ORDER BY created_at DESC',
  ).all<{
    id: string;
    endpoint: string;
    enabled: number;
    expiration_time: number | null;
    created_at: string;
    updated_at: string;
  }>();
  return context.json(success((results ?? []).map(subscriptionDto)));
});
app.post(`${API_PREFIX}/push/subscriptions`, async (context) => {
  const input = createPushSubscriptionSchema.safeParse(await context.req.json().catch(() => null));
  if (!input.success)
    return context.json(invalid(input.error.issues[0]?.message ?? '请求体无效'), 400);
  const id = publicId('sub');
  await context.env.NOTIFICATION_DB.prepare(
    `INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, expiration_time)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth,
       expiration_time = excluded.expiration_time, enabled = 1, updated_at = CURRENT_TIMESTAMP`,
  )
    .bind(
      id,
      input.data.endpoint,
      input.data.keys.p256dh,
      input.data.keys.auth,
      input.data.expirationTime ?? null,
    )
    .run();
  const row = await context.env.NOTIFICATION_DB.prepare(
    'SELECT id, endpoint, enabled, expiration_time, created_at, updated_at FROM push_subscriptions WHERE endpoint = ?',
  )
    .bind(input.data.endpoint)
    .first<{
      id: string;
      endpoint: string;
      enabled: number;
      expiration_time: number | null;
      created_at: string;
      updated_at: string;
    }>();
  return context.json(success(subscriptionDto(row!)), 201);
});
app.delete(`${API_PREFIX}/push/subscriptions/:id`, async (context) => {
  const result = await context.env.NOTIFICATION_DB.prepare(
    'DELETE FROM push_subscriptions WHERE id = ?',
  )
    .bind(context.req.param('id'))
    .run();
  return result.meta.changes
    ? context.body(null, 204)
    : context.json(failure('SUBSCRIPTION_NOT_FOUND', 'Push subscription not found.'), 404);
});
app.post(`${API_PREFIX}/messages`, async (context) => {
  const authorization = context.req.header('Authorization');
  if (!authorization?.startsWith('Bearer '))
    return context.json(failure('INVALID_API_KEY', 'Missing API key.'), 401);
  const apiKey = await context.env.NOTIFICATION_DB.prepare(
    'SELECT id, project_id FROM project_api_keys WHERE key_hash = ? AND enabled = 1',
  )
    .bind(await hashKey(authorization.slice(7)))
    .first<{ id: string; project_id: string }>();
  if (!apiKey) return context.json(failure('INVALID_API_KEY', 'Invalid API key.'), 401);
  const input = createMessageSchema.safeParse(await context.req.json().catch(() => null));
  if (!input.success)
    return context.json(invalid(input.error.issues[0]?.message ?? '请求体无效'), 400);
  const id = publicId('msg');
  await context.env.NOTIFICATION_DB.batch([
    context.env.NOTIFICATION_DB.prepare(
      'INSERT INTO messages (id, project_id, level, title, message, url, tags, metadata, dedupe_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(
      id,
      apiKey.project_id,
      input.data.level,
      input.data.title,
      input.data.message,
      input.data.url ?? null,
      input.data.tags ? JSON.stringify(input.data.tags) : null,
      input.data.metadata ? JSON.stringify(input.data.metadata) : null,
      input.data.dedupeKey ?? null,
    ),
    context.env.NOTIFICATION_DB.prepare(
      'UPDATE project_api_keys SET last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ).bind(apiKey.id),
  ]);
  context.executionCtx.waitUntil(
    deliverMessage(context.env.NOTIFICATION_DB, context.env, {
      id,
      title: input.data.title,
      message: input.data.message,
      url: input.data.url,
    }),
  );
  return context.json(success({ id }), 201);
});
app.get(`${API_PREFIX}/messages`, async (context) => {
  const page = Math.max(1, Number(context.req.query('page') ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(context.req.query('pageSize') ?? 20) || 20));
  const clauses: string[] = [];
  const values: unknown[] = [];
  const filter = (column: string, value: string | undefined) => {
    if (value) {
      clauses.push(`${column} = ?`);
      values.push(value);
    }
  };
  filter('p.slug', context.req.query('project'));
  filter('m.level', context.req.query('level'));
  const keyword = context.req.query('keyword');
  if (keyword) {
    clauses.push('(m.title LIKE ? OR m.message LIKE ?)');
    values.push(`%${keyword}%`, `%${keyword}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const base = 'FROM messages m JOIN projects p ON p.id = m.project_id';
  const count = await context.env.NOTIFICATION_DB.prepare(
    `SELECT COUNT(*) AS total ${base} ${where}`,
  )
    .bind(...values)
    .first<{ total: number }>();
  const { results } = await context.env.NOTIFICATION_DB.prepare(
    `SELECT m.*, p.name AS project_name, p.slug AS project_slug ${base} ${where} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...values, pageSize, (page - 1) * pageSize)
    .all<MessageRow>();
  return context.json(
    success({ items: (results ?? []).map(messageDto), page, pageSize, total: count?.total ?? 0 }),
  );
});
app.get(`${API_PREFIX}/messages/:id`, async (context) => {
  const row = await context.env.NOTIFICATION_DB.prepare(
    'SELECT m.*, p.name AS project_name, p.slug AS project_slug FROM messages m JOIN projects p ON p.id = m.project_id WHERE m.id = ?',
  )
    .bind(context.req.param('id'))
    .first<MessageRow>();
  return row
    ? context.json(success(messageDto(row)))
    : context.json(failure('MESSAGE_NOT_FOUND', 'Message not found.'), 404);
});
app.notFound((context) => context.json(failure('INVALID_REQUEST', 'Route not found.'), 404));
export default app;
