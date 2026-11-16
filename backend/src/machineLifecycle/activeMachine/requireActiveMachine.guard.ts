import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { DatabaseService } from '../../database/database.service';
import { assertFullMachineAccess } from './activeMachine.repository';
import { ACCESSIBLE_MACHINES } from '../../machineSharing/access/machineScope';

// Inactive machines show identity and summary only: full history,
// configuration and photos need an active machine. Documents are the
// exception and don't use this guard (machineDocuments.controller.ts). Reads :machineId from
// the route; a missing machine (or one outside the caller's machine
// groups) is left to the handler's own 404. Must run after JwtAuthGuard.
@Injectable()
export class RequireActiveMachineGuard implements CanActivate {
  constructor(private readonly databaseService: DatabaseService) {}

  canActivate = async (context: ExecutionContext): Promise<boolean> => {
    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
      params: { machineId?: string };
    }>();
    const machineId = request.params.machineId;
    if (!machineId) return true;
    await this.databaseService.withActor(request.user, (client) =>
      assertFullMachineAccess(
        client,
        request.user.tenantId,
        machineId,
        ACCESSIBLE_MACHINES,
      ),
    );
    return true;
  };
}
