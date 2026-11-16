import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { DatabaseService } from '../../database/database.service';
import { assertMachineControlEnabled } from './machineControlAccess';

// 403 machine_control_disabled unless the caller's organisation has Machine
// Control turned on. Must run after JwtAuthGuard.
@Injectable()
export class RequireMachineControlGuard implements CanActivate {
  constructor(private readonly databaseService: DatabaseService) {}

  canActivate = async (context: ExecutionContext): Promise<boolean> => {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    await this.databaseService.withActor(user, (client) =>
      assertMachineControlEnabled(client, user.tenantId),
    );
    return true;
  };
}
