import {
  buildPushMessage,
  findExistingEndpointArn,
  resolvePushTarget,
} from './pushPlatform';

const DEFAULT_BUNDLE = 'au.com.quiptechfield.field';
const notification = {
  id: 'n1',
  kind: 'case_message',
  title: 'New reply on case 1042',
  body: 'Hydraulic leak fixed',
  link: '/cases/1042',
};

describe('push platform rules', () => {
  it('picks the platform application from the bundle and APNs environment', () => {
    expect(
      resolvePushTarget(
        {
          deviceType: 'ios',
          bundleId: 'au.com.quiptechfield.field.dev',
          apnsEnvironment: 'sandbox',
        },
        DEFAULT_BUNDLE,
      ),
    ).toEqual({
      bundleId: 'au.com.quiptechfield.field.dev',
      apnsEnvironment: 'sandbox',
      platformKey: 'au.com.quiptechfield.field.dev|sandbox',
    });
  });

  it('falls back to the production app and APNS when the app sends neither', () => {
    expect(
      resolvePushTarget({ deviceType: 'ios' }, DEFAULT_BUNDLE).platformKey,
    ).toBe('au.com.quiptechfield.field|production');
  });

  it('sends Android to the FCM application and leaves web unpushed', () => {
    expect(
      resolvePushTarget({ deviceType: 'android' }, DEFAULT_BUNDLE).platformKey,
    ).toBe('au.com.quiptechfield.field|fcm');
    expect(
      resolvePushTarget({ deviceType: 'web' }, DEFAULT_BUNDLE).platformKey,
    ).toBeNull();
  });

  it('reads the existing endpoint out of the "already exists" error', () => {
    expect(
      findExistingEndpointArn(
        'Invalid parameter: Token Reason: Endpoint arn:aws:sns:ap-southeast-2:123:endpoint/APNS/field-ios-prod/abc already exists with the same Token, but different attributes.',
      ),
    ).toBe('arn:aws:sns:ap-southeast-2:123:endpoint/APNS/field-ios-prod/abc');
    expect(findExistingEndpointArn('Invalid parameter: Token')).toBeNull();
  });

  it('builds the APNs payload with top-level notificationId, kind and link', () => {
    const message = JSON.parse(
      buildPushMessage(notification, 4, {
        deviceType: 'ios',
        apnsEnvironment: 'production',
      }),
    );
    expect(message.default).toBe(notification.title);
    expect(message.APNS_SANDBOX).toBeUndefined();
    expect(JSON.parse(message.APNS)).toEqual({
      aps: {
        alert: { title: notification.title, body: notification.body },
        sound: 'default',
        badge: 4,
      },
      notificationId: 'n1',
      kind: 'case_message',
      link: '/cases/1042',
    });
  });

  it('uses the APNS_SANDBOX key for development builds', () => {
    const message = JSON.parse(
      buildPushMessage(notification, 1, {
        deviceType: 'ios',
        apnsEnvironment: 'sandbox',
      }),
    );
    expect(Object.keys(message)).toEqual(['default', 'APNS_SANDBOX']);
  });

  it('builds the FCM v1 payload for Android', () => {
    const message = JSON.parse(
      buildPushMessage(notification, 1, {
        deviceType: 'android',
        apnsEnvironment: null,
      }),
    );
    expect(JSON.parse(message.GCM)).toEqual({
      fcmV1Message: {
        message: {
          notification: { title: notification.title, body: notification.body },
          data: {
            notificationId: 'n1',
            kind: 'case_message',
            link: '/cases/1042',
          },
          android: { notification: { channel_id: 'default' } },
        },
      },
    });
  });
});
