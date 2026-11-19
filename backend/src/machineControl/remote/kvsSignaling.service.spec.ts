import { ConfigService } from '@nestjs/config';
import { KvsSignalingService } from './kvsSignaling.service';

// The presigned wss:// URL each side opens: SigV4 query auth for the
// kinesisvideo service, with the channel and (for the viewer) client id.
describe('KvsSignalingService presign', () => {
  const env = { ...process.env };
  beforeAll(() => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIDEXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret';
    process.env.AWS_SESSION_TOKEN = 'token/with+chars=';
  });
  afterAll(() => {
    process.env = env;
  });

  const service = () =>
    new KvsSignalingService(
      new ConfigService({ REMOTE_SUPPORT_KVS_ENABLED: 'true' }),
    );
  const presign = (role: 'MASTER' | 'VIEWER', clientId: string | null) =>
    (
      service() as unknown as {
        presign: (
          endpoint: string,
          params: { channelArn: string; role: string; clientId: string | null },
        ) => Promise<string>;
      }
    ).presign('wss://v-1234.kinesisvideo.ap-southeast-2.amazonaws.com', {
      channelArn:
        'arn:aws:kinesisvideo:ap-southeast-2:123456789012:channel/field-remote-x/1',
      role,
      clientId,
    });

  it('signs the viewer URL with its client id', async () => {
    const url = new URL(await presign('VIEWER', 'viewer-abc'));
    expect(url.protocol).toBe('wss:');
    expect(url.hostname).toBe('v-1234.kinesisvideo.ap-southeast-2.amazonaws.com');
    expect(url.searchParams.get('X-Amz-ChannelARN')).toContain('channel/field-remote-x/1');
    expect(url.searchParams.get('X-Amz-ClientId')).toBe('viewer-abc');
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-Credential')).toMatch(
      /^AKIDEXAMPLE\/\d{8}\/ap-southeast-2\/kinesisvideo\/aws4_request$/,
    );
    expect(url.searchParams.get('X-Amz-Security-Token')).toBe('token/with+chars=');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('signs the master URL without a client id', async () => {
    const url = new URL(await presign('MASTER', null));
    expect(url.searchParams.has('X-Amz-ClientId')).toBe(false);
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses when remote support is off', async () => {
    const off = new KvsSignalingService(new ConfigService({}));
    await expect(off.ensureChannel('x')).rejects.toMatchObject({ status: 503 });
  });
});
