import { Injectable, Logger } from '@nestjs/common';
import { DemoRequestsConfig } from './demoRequestsConfig';

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5000;

// 'unavailable' = Cloudflare couldn't be asked (not set up, network
// error, timeout): the caller should ask the person to try again rather
// than call them a bot.
export type TurnstileResult = 'valid' | 'invalid' | 'unavailable';

// Checks a Cloudflare Turnstile token server-side. Tokens are single-use
// and expire after 5 minutes, which Cloudflare enforces.
@Injectable()
export class TurnstileVerifierService {
  private readonly logger = new Logger(TurnstileVerifierService.name);

  constructor(private readonly config: DemoRequestsConfig) {}

  verify = async (
    token: string,
    remoteIp: string | null,
  ): Promise<TurnstileResult> => {
    const secret = this.config.turnstileSecretKey;
    if (!secret) {
      this.logger.error(
        'TURNSTILE_SECRET_KEY is not set: refusing demo requests.',
      );
      return 'unavailable';
    }
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);
    try {
      const response = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.error(`Turnstile siteverify returned ${response.status}.`);
        return 'unavailable';
      }
      const result = (await response.json()) as {
        success?: boolean;
        'error-codes'?: string[];
      };
      if (result.success === true) return 'valid';
      this.logger.warn(
        `Turnstile rejected a token: ${(result['error-codes'] ?? []).join(', ')}`,
      );
      return 'invalid';
    } catch (error) {
      this.logger.error(
        `Turnstile siteverify failed: ${(error as Error).message}`,
      );
      return 'unavailable';
    }
  };
}
