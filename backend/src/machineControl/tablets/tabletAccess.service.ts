import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { hashToken } from '../../common/security/tokenHasher';
import { DatabaseService } from '../../database/database.service';
import { requireMachineAccess } from '../../machineSharing/access/machineAccess';
import { newDeviceToken } from '../session/deviceSession.service';
import {
  AddTabletDto,
  RegisterTabletDto,
  TabletPasswordDto,
} from './tabletAccess.dtos';
import * as repository from './tabletAccess.repository';
import { TabletCredentialsService } from './tabletCredentials.service';
import { hashTabletPassword } from './tabletPassword';

export const TABLET_TOKEN_INVALID = 'TABLET_TOKEN_INVALID';

const invalidTabletToken = () =>
  new UnauthorizedException({
    statusCode: 401,
    error: 'Unauthorized',
    code: TABLET_TOKEN_INVALID,
    message: 'This tablet registration is no longer valid. Register again.',
  });

const notAssigned = () =>
  new ConflictException({
    code: 'tablet_not_assigned',
    message: "This tablet hasn't been added to a machine yet.",
  });

// A tablet's registration (FIELD ID + password) and the Portal adding it to
// a machine (migration 0143).
@Injectable()
export class TabletAccessService {
  constructor(
    private readonly db: DatabaseService,
    private readonly credentials: TabletCredentialsService,
  ) {}

  // ── Tablet ──────────────────────────────────────────────────────────

  // deviceToken: sent by a tablet already paired with a code, which keeps its
  // machine. The tablet token is only ever returned here.
  register = async (dto: RegisterTabletDto, deviceToken: string | null) => {
    const tabletToken = newDeviceToken();
    const passwordHash = await hashTabletPassword(dto.password);
    const fieldId = await this.db.transaction((client) =>
      repository.registerTablet(client, {
        passwordHash,
        tokenHash: hashToken(tabletToken),
        serialNumber: dto.serialNumber ?? null,
        platform: dto.platform ?? null,
        appVersion: dto.appVersion ?? null,
        deviceTokenHash: deviceToken ? hashToken(deviceToken) : null,
      }),
    );
    return { fieldId, tabletToken };
  };

  registration = async (tabletToken: string) => {
    const tablet = await this.requireTablet(tabletToken);
    return {
      fieldId: tablet.field_id,
      assigned: tablet.device_id !== null,
      machine: tablet.machine_id
        ? { id: tablet.machine_id, label: tablet.machine_label }
        : null,
    };
  };

  changePassword = async (tabletToken: string, dto: TabletPasswordDto) => {
    await this.requireTablet(tabletToken);
    const changed = await repository.changeUnassignedPassword(
      this.db,
      hashToken(tabletToken),
      await hashTabletPassword(dto.password),
    );
    if (!changed) {
      throw new ConflictException({
        code: 'tablet_password_managed_in_portal',
        message: 'This password is now changed from the FIELD Portal.',
      });
    }
  };

  // A device token for the machine the tablet was added to.
  openSession = async (tabletToken: string) => {
    await this.requireTablet(tabletToken);
    const deviceToken = newDeviceToken();
    const opened = await this.db.transaction((client) =>
      repository.openTabletSession(
        client,
        hashToken(tabletToken),
        hashToken(deviceToken),
      ),
    );
    if (!opened) throw notAssigned();
    return {
      deviceId: opened.device_id,
      deviceToken,
      machine: { id: opened.machine_id, label: opened.machine_label },
    };
  };

  // ── Portal ──────────────────────────────────────────────────────────

  addToMachine = async (
    actor: AuthenticatedUser,
    machineId: string,
    dto: AddTabletDto,
  ): Promise<void> => {
    await this.db.withActor(actor, (client) =>
      requireMachineAccess(client, machineId, 'contribute'),
    );
    const { tabletId } = await this.credentials.verify(actor, {
      fieldId: dto.fieldId,
      password: dto.password,
      machineId,
    });
    await this.db.withActor(actor, (client) =>
      repository.assignTablet(client, tabletId, machineId),
    );
  };

  resetPassword = async (
    actor: AuthenticatedUser,
    machineId: string,
    dto: TabletPasswordDto,
  ): Promise<void> => {
    const passwordHash = await hashTabletPassword(dto.password);
    const changed = await this.db.withActor(actor, async (client) => {
      await requireMachineAccess(client, machineId, 'contribute');
      return repository.resetTabletPassword(client, machineId, passwordHash);
    });
    if (!changed) {
      throw new ConflictException({
        code: 'machine_has_no_registered_tablet',
        message: 'This machine has no tablet with a FIELD ID.',
      });
    }
  };

  private requireTablet = async (tabletToken: string) => {
    const tablet = await repository.findTabletByToken(
      this.db,
      hashToken(tabletToken),
    );
    if (!tablet) throw invalidTabletToken();
    return tablet;
  };
}
