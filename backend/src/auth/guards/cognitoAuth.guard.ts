import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { CognitoTokenVerifierService } from '../cognito/cognitoTokenVerifier.service';
import { CognitoIdentity } from '../types/cognitoIdentity';

export interface CognitoAuthenticatedRequest extends Request {
  cognitoIdentity: CognitoIdentity;
}

const extractBearerToken = (request: Request): string => {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedException('Missing Cognito bearer token.');
  }
  return token;
};

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  constructor(
    private readonly cognitoTokenVerifier: CognitoTokenVerifierService,
  ) {}

  canActivate = async (context: ExecutionContext): Promise<boolean> => {
    const request = context
      .switchToHttp()
      .getRequest<CognitoAuthenticatedRequest>();
    request.cognitoIdentity = await this.cognitoTokenVerifier.verifyIdToken(
      extractBearerToken(request),
    );
    return true;
  };
}
