import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { DatabaseService } from '../../database/database.service';
import * as repository from './tabletAccess.repository';
import { verifyTabletPassword } from './tabletPassword';

// Checks a FIELD ID and password for a signed-in person. The attempt is
// counted and committed before the check, so a refused request still counts.
@Injectable()
export class TabletCredentialsService {
  constructor(private readonly db: DatabaseService) {}

  // machineId: the machine being added to or connected, if known. Returns the
  // tablet and the machine it is on now (null if none).
  verify = async (
    actor: AuthenticatedUser,
    params: { fieldId: string; password: string; machineId: string | null },
  ): Promise<{ tabletId: string; machineId: string | null }> => {
    const attempt = await this.db.withActor(actor, (client) =>
      repository.countPasswordAttempt(client, params.fieldId, params.machineId),
    );
    if (
      !attempt ||
      !(await verifyTabletPassword(params.password, attempt.password_hash))
    ) {
      throw repository.wrongTabletCredentials();
    }
    await this.db.withActor(actor, (client) =>
      repository.acceptPassword(client, attempt.tablet_id),
    );
    return { tabletId: attempt.tablet_id, machineId: attempt.machine_id };
  };
}
