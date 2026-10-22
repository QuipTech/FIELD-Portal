import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { runAuditedChange } from '../../common/audit/runAuditedChange';
import { KnowledgeAccessService } from '../access/knowledgeAccess.service';
import { SetBrandAccessDto } from '../dto/knowledgeTaxonomyDtos';
import * as taxonomyRepository from './knowledgeTaxonomy.repository';
import { BrandAccessRow } from './knowledgeTaxonomy.repository';

const TENANT_NOT_FOUND_MESSAGE = 'Organisation not found.';
const UNKNOWN_BRAND_MESSAGE = 'One or more brands no longer exist.';

// GET /admin/knowledge/brand-access and PUT …/:tenantId
export interface BrandAccess {
  tenantId: string;
  isRestricted: boolean;
  // Every brand; hasAccess is true for all of them when not restricted.
  brands: { id: string; name: string; hasAccess: boolean }[];
}

const toBrandAccess = (
  tenantId: string,
  isRestricted: boolean,
  rows: BrandAccessRow[],
): BrandAccess => ({
  tenantId,
  isRestricted,
  brands: rows.map((row) => ({
    id: row.id,
    name: row.name,
    hasAccess: !isRestricted || row.has_access,
  })),
});

@Injectable()
export class BrandAccessService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly knowledgeAccess: KnowledgeAccessService,
  ) {}

  // The caller's own organisation (read-only for organisation admins).
  getOwn = async (actor: AuthenticatedUser): Promise<BrandAccess> => {
    const access = await this.knowledgeAccess.resolve(actor);
    const rows = await this.databaseService.withTenant(
      actor.tenantId,
      (client) =>
        taxonomyRepository.listBrandAccess(client, access.brandIds ?? []),
    );
    return toBrandAccess(actor.tenantId, access.brandIds !== null, rows);
  };

  // Platform admins (the controller guards it): any organisation's plan.
  setForTenant = (
    actor: AuthenticatedUser,
    tenantId: string,
    dto: SetBrandAccessDto,
  ): Promise<BrandAccess> =>
    runAuditedChange(this.databaseService, actor, '', async (client) => {
      const known = await taxonomyRepository.countLiveBrands(
        client,
        dto.brandIds,
      );
      if (known !== dto.brandIds.length) {
        throw new BadRequestException(UNKNOWN_BRAND_MESSAGE);
      }
      const updated = await taxonomyRepository.setTenantBrandAccess(client, {
        tenantId,
        restricted: dto.isRestricted,
        brandIds: dto.brandIds,
        userId: actor.userId,
      });
      if (!updated) throw new NotFoundException(TENANT_NOT_FOUND_MESSAGE);
      const rows = await taxonomyRepository.listBrandAccess(
        client,
        dto.brandIds,
      );
      return {
        result: toBrandAccess(tenantId, dto.isRestricted, rows),
        audit: {
          action: 'update',
          entityType: 'knowledge_brand_access',
          entityId: tenantId,
          metadata: { knowledgeBrandAccess: { ...dto } },
        },
      };
    });
}
