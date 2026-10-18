import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { insertAuditLog } from '../auth/auth.repository';

@Injectable()
export class OrganisationBrandAccessService {
  constructor(private readonly database: DatabaseService) {}
  get = (actor: AuthenticatedUser, id: string) =>
    this.database.withActor(actor, async (client) => {
      if (
        !(await client.query('SELECT id FROM tenants WHERE id=$1', [id]))
          .rowCount
      )
        throw new NotFoundException('Organisation not found.');
      return {
        brandIds: (
          await client.query<{ brand_id: string }>(
            'SELECT brand_id FROM organisation_brand_access WHERE organisation_id=$1',
            [id],
          )
        ).rows.map((row) => row.brand_id),
      };
    });
  set = (actor: AuthenticatedUser, id: string, ids: string[]) =>
    this.database.withActor(actor, async (client) => {
      // Serialize replacements per organisation and audit the actual diff.
      if (
        !(
          await client.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE', [
            id,
          ])
        ).rowCount
      )
        throw new NotFoundException('Organisation not found.');
      const brands = await client.query(
        'SELECT id FROM knowledge_brands WHERE id=ANY($1::uuid[])',
        [ids],
      );
      if (brands.rowCount !== ids.length)
        throw new BadRequestException('Unknown brand.');
      const previous = (
        await client.query<{ brand_id: string }>(
          'SELECT brand_id FROM organisation_brand_access WHERE organisation_id=$1',
          [id],
        )
      ).rows.map((row) => row.brand_id);
      const revoked = previous.filter((brandId) => !ids.includes(brandId));
      const granted = ids.filter((brandId) => !previous.includes(brandId));
      await client.query(
        'DELETE FROM organisation_brand_access WHERE organisation_id=$1 AND NOT(brand_id=ANY($2::uuid[]))',
        [id, ids],
      );
      await client.query(
        'INSERT INTO organisation_brand_access(organisation_id,brand_id,granted_by) SELECT $1,unnest($2::uuid[]),$3 ON CONFLICT DO NOTHING',
        [id, granted, actor.userId],
      );
      for (const [event, brandIds] of [
        ['access_granted', granted],
        ['access_revoked', revoked],
      ] as const) {
        for (const brandId of brandIds)
          await insertAuditLog(client, {
            tenantId: actor.tenantId,
            userId: actor.userId,
            action: 'update',
            entityType: 'organisation_brand_access',
            entityId: id,
            metadata: { event, brandId },
          });
      }
      return { brandIds: ids };
    });
}
