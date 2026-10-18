import { rethrowKnowledgeBrandError } from './knowledgeBrandErrors';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticatedUser';
import { runAuditedChange } from '../common/audit/runAuditedChange';
import {
  selectAccessibleBrands,
  selectAccessibleCategories,
  selectBrandCategories,
} from './knowledgeBrandListing.repository';
import {
  KnowledgeBrandDto,
  KnowledgeCategoryDto,
} from './dto/knowledgeBrandDto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class KnowledgeBrandsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  // One transaction each: every extra query costs a full database round trip.
  listBrands = async (actor: AuthenticatedUser) => {
    const brands = await this.database.withActor(actor, (client) =>
      selectAccessibleBrands(client, actor),
    );
    return Promise.all(
      brands.map(async ({ logo_storage_key, ...brand }) => ({
        ...brand,
        logoUrl: logo_storage_key
          ? (await this.storage.getSignedDownloadUrl(logo_storage_key)).url
          : null,
      })),
    );
  };

  listCategories = async (actor: AuthenticatedUser, brandId: string) => {
    const categories = await this.database.withActor(actor, (client) =>
      selectBrandCategories(client, actor, brandId),
    );
    if (!categories) throw new NotFoundException('Brand not found.');
    return categories;
  };

  listAllCategories = (actor: AuthenticatedUser) =>
    this.database.withActor(actor, (client) =>
      selectAccessibleCategories(client, actor),
    );

  listModels = (actor: AuthenticatedUser) =>
    this.database.withActor(
      actor,
      async (client) =>
        (
          await client.query(
            `SELECT DISTINCT mm.id,mf.name || ' ' || mm.name AS "displayName"
     FROM machine_models mm JOIN machine_manufacturers mf ON mf.id=mm.manufacturer_id
     JOIN knowledge_item_machine_models km ON km.machine_model_id=mm.id
     JOIN documents d ON d.knowledge_item_id=km.knowledge_item_id
     JOIN knowledge_items ki ON ki.id=d.knowledge_item_id
     WHERE mm.deleted_at IS NULL AND mf.deleted_at IS NULL AND d.live_version_id IS NOT NULL
       AND ki.status NOT IN ('archived','withdrawn') AND knowledge_can_read_document(d.id,$1,$2)
     ORDER BY "displayName"`,
            [actor.tenantId, actor.userId],
          )
        ).rows,
    );

  saveBrand = (actor: AuthenticatedUser, dto: KnowledgeBrandDto, id?: string) =>
    this.change(actor, 'knowledge_brand', id, async (client) => {
      const values = [
        dto.name.trim(),
        dto.slug,
        dto.description ?? '',
        dto.isActive ?? true,
        dto.sortOrder ?? 0,
      ];
      return id
        ? client.query(
            `UPDATE knowledge_brands SET name=$1,slug=$2,description=$3,is_active=$4,sort_order=$5 WHERE id=$6 RETURNING id`,
            [...values, id],
          )
        : client.query(
            `INSERT INTO knowledge_brands(name,slug,description,is_active,sort_order) VALUES($1,$2,$3,$4,$5) RETURNING id`,
            values,
          );
    });

  saveCategory = (
    actor: AuthenticatedUser,
    brandId: string,
    dto: KnowledgeCategoryDto,
    id?: string,
  ) =>
    this.change(actor, 'knowledge_category', id, async (client) => {
      const values = [
        brandId,
        dto.parentId ?? null,
        dto.name.trim(),
        dto.slug,
        dto.sortOrder ?? 0,
      ];
      return id
        ? client.query(
            `UPDATE knowledge_categories SET parent_id=$2,name=$3,slug=$4,sort_order=$5 WHERE brand_id=$1 AND id=$6 RETURNING id`,
            [...values, id],
          )
        : client.query(
            `INSERT INTO knowledge_categories(brand_id,parent_id,name,slug,sort_order) VALUES($1,$2,$3,$4,$5) RETURNING id`,
            values,
          );
    });

  remove = async (
    actor: AuthenticatedUser,
    kind: 'brand' | 'category',
    id: string,
    brandId?: string,
  ) => {
    try {
      return await runAuditedChange(
        this.database,
        actor,
        'This name is already in use.',
        async (client) => {
          // Grants from before 0093 are no longer used or editable; they
          // would otherwise block deleting the brand.
          if (kind === 'brand')
            await client.query(
              'DELETE FROM organisation_brand_access WHERE brand_id=$1',
              [id],
            );
          const result =
            kind === 'brand'
              ? await client.query(
                  'DELETE FROM knowledge_brands WHERE id=$1 RETURNING id',
                  [id],
                )
              : await client.query(
                  'DELETE FROM knowledge_categories WHERE id=$1 AND brand_id=$2 RETURNING id',
                  [id, brandId],
                );
          if (!result.rowCount) throw new NotFoundException('Not found.');
          return {
            result: null,
            audit: {
              action: 'delete',
              entityType: `knowledge_${kind}`,
              entityId: id,
              metadata: {},
            },
          };
        },
      );
    } catch (error) {
      return rethrowKnowledgeBrandError(error);
    }
  };

  private change = async (
    actor: AuthenticatedUser,
    entityType: string,
    id: string | undefined,
    query: (
      client: import('pg').PoolClient,
    ) => Promise<import('pg').QueryResult<{ id: string }>>,
  ) => {
    try {
      return await runAuditedChange(
        this.database,
        actor,
        'This slug is already in use.',
        async (client) => {
          const result = await query(client);
          if (!result.rows[0]) throw new NotFoundException('Not found.');
          return {
            result: result.rows[0],
            audit: {
              action: id ? 'update' : 'create',
              entityType,
              entityId: result.rows[0].id,
              metadata: {},
            },
          };
        },
      );
    } catch (error) {
      return rethrowKnowledgeBrandError(error);
    }
  };
}
