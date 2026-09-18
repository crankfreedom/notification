import * as webpush from 'web-push';

export type NotificationMessage = {
  id: string;
  title: string;
  message: string;
  url?: string;
};

export type NotificationTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type NotificationResult = {
  status: 'sent' | 'failed' | 'expired';
  error?: string;
};

export interface NotificationChannel {
  send(message: NotificationMessage, target: NotificationTarget): Promise<NotificationResult>;
}

type VapidConfig = {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

export class WebPushChannel implements NotificationChannel {
  constructor(private readonly config: VapidConfig) {}

  async send(
    message: NotificationMessage,
    target: NotificationTarget,
  ): Promise<NotificationResult> {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = this.config;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT)
      return { status: 'failed', error: 'Web Push is not configured.' };

    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify({
          title: message.title,
          body: message.message,
          data: { messageId: message.id, url: message.url ?? '/messages' },
        }),
        {
          TTL: 60 * 60,
          urgency: 'high',
          vapidDetails: {
            subject: VAPID_SUBJECT,
            publicKey: VAPID_PUBLIC_KEY,
            privateKey: VAPID_PRIVATE_KEY,
          },
        },
      );
      return { status: 'sent' };
    } catch (error) {
      const statusCode = error instanceof webpush.WebPushError ? error.statusCode : undefined;
      return {
        status: statusCode === 404 || statusCode === 410 ? 'expired' : 'failed',
        error: statusCode ? `Push service returned HTTP ${statusCode}.` : 'Push delivery failed.',
      };
    }
  }
}
