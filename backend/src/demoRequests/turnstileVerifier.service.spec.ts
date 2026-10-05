import { TurnstileVerifierService } from './turnstileVerifier.service';
import { DemoRequestsConfig } from './demoRequestsConfig';

const verifier = (secret: string | undefined) =>
  new TurnstileVerifierService({
    turnstileSecretKey: secret,
  } as DemoRequestsConfig);

const fetchMock = jest.spyOn(global, 'fetch');
const respond = (body: object, status = 200) =>
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status }),
  );

describe('TurnstileVerifierService', () => {
  beforeEach(() => fetchMock.mockReset());

  it('accepts a token Cloudflare confirms, sending the secret and IP', async () => {
    respond({ success: true });
    expect(await verifier('secret').verify('token', '203.0.113.9')).toBe(
      'valid',
    );
    const body = fetchMock.mock.calls[0][1]?.body as URLSearchParams;
    expect(Object.fromEntries(body)).toEqual({
      secret: 'secret',
      response: 'token',
      remoteip: '203.0.113.9',
    });
  });

  it('rejects a token Cloudflare refuses', async () => {
    respond({ success: false, 'error-codes': ['invalid-input-response'] });
    expect(await verifier('secret').verify('bad', null)).toBe('invalid');
  });

  it('is unavailable (not invalid) when Cloudflare cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    expect(await verifier('secret').verify('token', null)).toBe('unavailable');
  });

  it('refuses everything while TURNSTILE_SECRET_KEY is unset', async () => {
    expect(await verifier(undefined).verify('token', null)).toBe('unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
