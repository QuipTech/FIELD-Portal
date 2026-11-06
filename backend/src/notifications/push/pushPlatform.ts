// Pure push rules: which SNS platform application a device belongs to, and
// the message SNS sends to APNs or FCM.

export type ApnsEnvironment = 'sandbox' | 'production';

export interface PushTarget {
  bundleId: string | null;
  apnsEnvironment: ApnsEnvironment | null;
  // Key into PUSH_PLATFORM_APPLICATIONS; null for devices that can't be pushed.
  platformKey: string | null;
}

// Every build calls the same API, so the bundle ID and APNs environment the
// app sends are the only way to pick the platform application. A token sent
// to the wrong one fails with BadDeviceToken and SNS disables the endpoint.
// Missing values mean the production app.
export const resolvePushTarget = (
  device: {
    deviceType: string;
    bundleId?: string | null;
    apnsEnvironment?: ApnsEnvironment | null;
  },
  defaultBundleId: string,
): PushTarget => {
  const bundleId = device.bundleId || defaultBundleId;
  if (device.deviceType === 'ios') {
    const apnsEnvironment = device.apnsEnvironment ?? 'production';
    return {
      bundleId,
      apnsEnvironment,
      platformKey: `${bundleId}|${apnsEnvironment}`,
    };
  }
  if (device.deviceType === 'android')
    return { bundleId, apnsEnvironment: null, platformKey: `${bundleId}|fcm` };
  return {
    bundleId: device.bundleId ?? null,
    apnsEnvironment: null,
    platformKey: null,
  };
};

// CreatePlatformEndpoint refuses a token that already has an endpoint with
// other attributes ("Invalid parameter: Token Reason: Endpoint arn:… already
// exists with the same Token, but different attributes."): reuse that one.
export const findExistingEndpointArn = (message: string): string | null =>
  /Endpoint (arn:aws:sns:\S+) already exists/.exec(message)?.[1] ?? null;

export interface PushNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string;
}

// The SNS message (MessageStructure: 'json'). The app reads exactly
// notificationId, kind and link, as top-level strings (APNs) or data
// strings (FCM). The APNs key must match the endpoint's platform —
// APNS_SANDBOX for development builds — or the push is silently dropped.
export const buildPushMessage = (
  notification: PushNotification,
  unreadCount: number,
  device: { deviceType: string; apnsEnvironment: ApnsEnvironment | null },
): string => {
  const custom = {
    notificationId: notification.id,
    kind: notification.kind,
    link: notification.link,
  };
  if (device.deviceType === 'android') {
    const fcm = {
      fcmV1Message: {
        message: {
          notification: {
            title: notification.title,
            body: notification.body ?? '',
          },
          data: custom,
          android: { notification: { channel_id: 'default' } },
        },
      },
    };
    return JSON.stringify({
      default: notification.title,
      GCM: JSON.stringify(fcm),
    });
  }
  const aps = JSON.stringify({
    aps: {
      alert: { title: notification.title, body: notification.body ?? '' },
      sound: 'default',
      badge: unreadCount,
    },
    ...custom,
  });
  const platform =
    device.apnsEnvironment === 'sandbox' ? 'APNS_SANDBOX' : 'APNS';
  return JSON.stringify({ default: notification.title, [platform]: aps });
};
