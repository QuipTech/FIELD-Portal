import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { IncomingFile } from '../storage/types/storedFile';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import * as brandingRepository from './branding.repository';
import { UpdateBrandingDto } from './dto/updateBrandingDto';
import { BrandingRow } from './types/brandingRows';
import { OrganisationBranding } from './types/brandingResponse';

const ORGANISATION_NOT_FOUND_MESSAGE = 'Organisation not found.';
const CONFLICT_MESSAGE =
  'Branding changed at the same time. Reload and try again.';

// The signed-in user's own organisation's branding. Every method works on
// actor.tenantId only, so one organisation can never touch another's.
@Injectable()
export class BrandingService {
  private readonly logger = new Logger(BrandingService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  getBranding = async (
    actor: AuthenticatedUser,
  ): Promise<OrganisationBranding> => {
    const row = await this.databaseService.withTenant(
      actor.tenantId,
      (client) => brandingRepository.findBranding(client, actor.tenantId),
    );
    return this.toBranding(this.assertFound(row));
  };

  updateBranding = async (
    actor: AuthenticatedUser,
    dto: UpdateBrandingDto,
  ): Promise<OrganisationBranding> => {
    const row = await runAuditedChange(
      this.databaseService,
      actor,
      CONFLICT_MESSAGE,
      async (client) => {
        const before = this.assertFound(
          await brandingRepository.findBranding(client, actor.tenantId),
        );
        const after = this.assertFound(
          await brandingRepository.updateBranding(client, actor.tenantId, dto),
        );
        const metadata = {
          name: after.name,
          before: this.toAuditSnapshot(before),
          after: this.toAuditSnapshot(after),
        };
        return {
          result: after,
          audit: this.auditEntry(actor.tenantId, metadata),
        };
      },
    );
    return this.toBranding(row);
  };

  // New logo first, then the database; the old file is deleted only once
  // both succeed, so a failure never leaves the organisation logo-less.
  uploadLogo = async (
    actor: AuthenticatedUser,
    file: IncomingFile | undefined,
  ): Promise<OrganisationBranding> => {
    const stored = await this.storageService.uploadBrandingLogo(
      file,
      actor.tenantId,
    );
    const { row, previousKey } = await this.replaceLogoKey(actor, stored.key, {
      logo: 'uploaded',
      fileName: stored.fileName,
    });
    await this.deleteLogoFile(previousKey, actor.tenantId);
    return this.toBranding(row);
  };

  removeLogo = async (
    actor: AuthenticatedUser,
  ): Promise<OrganisationBranding> => {
    const { row, previousKey } = await this.replaceLogoKey(actor, null, {
      logo: 'removed',
    });
    await this.deleteLogoFile(previousKey, actor.tenantId);
    return this.toBranding(row);
  };

  private replaceLogoKey = (
    actor: AuthenticatedUser,
    key: string | null,
    change: Record<string, unknown>,
  ) =>
    runAuditedChange(
      this.databaseService,
      actor,
      CONFLICT_MESSAGE,
      async (client) => {
        const before = this.assertFound(
          await brandingRepository.findBranding(client, actor.tenantId),
        );
        const row = this.assertFound(
          await brandingRepository.setLogoStorageKey(
            client,
            actor.tenantId,
            key,
          ),
        );
        const previousKey = before.branding_logo_storage_key;
        return {
          result: { row, previousKey },
          audit: this.auditEntry(actor.tenantId, { name: row.name, ...change }),
        };
      },
    );

  private deleteLogoFile = async (
    key: string | null,
    tenantId: string,
  ): Promise<void> => {
    if (!key) return;
    await this.storageService
      .deleteFile(key, tenantId)
      .catch((error: unknown) =>
        this.logger.warn(`Couldn't delete old logo ${key}: ${String(error)}`),
      );
  };

  // The branding belongs to the organisation, so its id is the entity id.
  private auditEntry = (
    tenantId: string,
    metadata: Record<string, unknown>,
  ) => ({
    action: 'update' as const,
    entityType: 'organisation_branding',
    entityId: tenantId,
    metadata,
  });

  private toAuditSnapshot = (row: BrandingRow) => ({
    companyName: row.name,
    primaryColor: row.branding_color_primary,
    accentColor: row.branding_color_accent,
    supportFooter: row.branding_support_footer,
    showWatermark: row.branding_show_watermark,
  });

  private assertFound = (row: BrandingRow | undefined): BrandingRow => {
    if (!row) throw new NotFoundException(ORGANISATION_NOT_FOUND_MESSAGE);
    return row;
  };

  // If signing fails (e.g. storage not configured) the page still loads,
  // just without the uploaded logo.
  private toBranding = async (
    row: BrandingRow,
  ): Promise<OrganisationBranding> => {
    let logoUrl = row.branding_logo_url;
    if (row.branding_logo_storage_key) {
      logoUrl = await this.storageService
        .getSignedDownloadUrl(row.branding_logo_storage_key)
        .then((signed) => signed.url)
        .catch(() => row.branding_logo_url);
    }
    return {
      organisationId: row.id,
      companyName: row.name,
      logoUrl,
      hasUploadedLogo: Boolean(row.branding_logo_storage_key),
      primaryColor: row.branding_color_primary,
      accentColor: row.branding_color_accent,
      supportFooter: row.branding_support_footer,
      showWatermark: row.branding_show_watermark,
      updatedAt: row.updated_at.toISOString(),
    };
  };
}
