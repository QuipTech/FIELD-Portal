import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CognitoIdentity } from '../types/cognitoIdentity';

export const CurrentCognitoIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CognitoIdentity =>
    context.switchToHttp().getRequest().cognitoIdentity,
);
