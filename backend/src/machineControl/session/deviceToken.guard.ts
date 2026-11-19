import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import {
  DeviceSessionService,
  PairedDevice,
  revokedTokenError,
} from './deviceSession.service';

interface DeviceRequest extends Request {
  mcDevice?: PairedDevice;
  mcDeviceToken?: string;
}

export const readBearerToken = (authorization?: string): string | null => {
  const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? '');
  return match?.[1] ?? null;
};

// A paired tablet's REST calls: `Authorization: Bearer <deviceToken>`.
// A missing, revoked or replaced token is a 401 DEVICE_TOKEN_REVOKED.
@Injectable()
export class DeviceTokenGuard implements CanActivate {
  constructor(private readonly sessions: DeviceSessionService) {}

  canActivate = async (context: ExecutionContext): Promise<boolean> => {
    const request = context.switchToHttp().getRequest<DeviceRequest>();
    const token = readBearerToken(request.headers.authorization);
    const device = token && (await this.sessions.authenticate(token));
    if (!device) throw revokedTokenError();
    request.mcDevice = device;
    request.mcDeviceToken = token;
    return true;
  };
}

export const CurrentDevice = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<DeviceRequest>().mcDevice,
);

export const CurrentDeviceToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<DeviceRequest>().mcDeviceToken,
);
