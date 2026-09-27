import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { CognitoIdentity } from '../types/cognitoIdentity';
import { mapCognitoIdentity } from './mapCognitoIdentity';

const buildIdTokenVerifier = (configService: ConfigService) =>
  CognitoJwtVerifier.create({
    userPoolId: configService.getOrThrow<string>('COGNITO_USER_POOL_ID'),
    clientId: configService.getOrThrow<string>('COGNITO_CLIENT_ID'),
    // ID token, not access token: only the ID token carries email and the
    // `identities` claim that says which provider (Google/Apple) issued it.
    tokenUse: 'id',
  });

@Injectable()
export class CognitoTokenVerifierService {
  private readonly logger = new Logger(CognitoTokenVerifierService.name);
  private readonly verifier: ReturnType<typeof buildIdTokenVerifier>;

  constructor(configService: ConfigService) {
    this.verifier = buildIdTokenVerifier(configService);
  }

  verifyIdToken = async (idToken: string): Promise<CognitoIdentity> => {
    try {
      const payload = await this.verifier.verify(idToken);
      // Shows exactly which claims the user pool's attribute mapping put in
      // the token (e.g. whether Google's `picture` arrived at all).
      this.logger.log(`Cognito ID token claims: ${JSON.stringify(payload)}`);
      const identity = mapCognitoIdentity(payload);
      this.logger.log(`Mapped Cognito identity: ${JSON.stringify(identity)}`);
      return identity;
    } catch (error) {
      this.logger.warn(`Cognito ID token rejected: ${String(error)}`);
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired Cognito token.');
    }
  };
}
