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

const readBearerToken = (request: Request): string | null => {
  const [scheme, token] = (request.headers.authorization ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
};

// A paired tablet's REST calls: `Authorization: Bearer <deviceToken>`.
// A missing, revoked or replaced token is a 401 DEVICE_TOKEN_REVOKED.
@Injectable()
export class DeviceTokenGuard implements CanActivate {
  constructor(private readonly sessions: DeviceSessionService) {}

  canActivate = async (context: ExecutionContext): Promise<boolean> => {
    const request = context.switchToHttp().getRequest<DeviceRequest>();
    const token = readBearerToken(request);
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
