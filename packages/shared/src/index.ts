import { z } from 'zod';

export const API_PREFIX = '/api/v1' as const;

export const ERROR_CODES = {
  INVALID_API_KEY: 'INVALID_API_KEY',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  INVALID_REQUEST: 'INVALID_REQUEST',
  RATE_LIMITED: 'RATE_LIMITED',
  PUSH_FAILED: 'PUSH_FAILED',
  SUBSCRIPTION_NOT_FOUND: 'SUBSCRIPTION_NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const success = <T>(data: T): ApiSuccess<T> => ({ success: true, data });

export const failure = (code: ErrorCode, message: string): ApiFailure => ({
  success: false,
  error: { code, message },
});

export const MESSAGE_LEVELS = ['debug', 'info', 'success', 'warning', 'error', 'critical'] as const;
export type MessageLevel = (typeof MESSAGE_LEVELS)[number];

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 仅支持小写字母、数字和连字符')
    .max(80),
  description: z.string().trim().max(500).optional(),
});
export const updateProjectSchema = createProjectSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, '至少提供一个需要更新的字段');
export const createMessageSchema = z.object({
  level: z.enum(MESSAGE_LEVELS),
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(10_000),
  url: z.string().url().max(2_000).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  metadata: z.record(z.unknown()).optional(),
  dedupeKey: z.string().trim().min(1).max(200).optional(),
});
export const createPushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2_000),
  expirationTime: z.number().int().positive().nullable().optional(),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(512),
    auth: z.string().trim().min(1).max(512),
  }),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type CreatePushSubscriptionInput = z.infer<typeof createPushSubscriptionSchema>;
