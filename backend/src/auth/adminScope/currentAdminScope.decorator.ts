import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { AdminScope } from './adminScope';
import { AdminScopedRequest } from './adminScope.guard';

// The scope AdminScopeGuard resolved. Throws rather than defaulting, so a
// route that forgot the guard can never fall back to "every organisation".
export const CurrentAdminScope = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminScope => {
    const scope = context
      .switchToHttp()
      .getRequest<AdminScopedRequest>().adminScope;
    if (!scope) {
      throw new InternalServerErrorException('AdminScopeGuard is missing.');
    }
    return scope;
  },
);
