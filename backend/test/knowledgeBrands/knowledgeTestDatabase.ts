import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
// PGlite subpath typings use modern resolution; load its typed extension through Node here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../src/database/database.service';
import { AuthenticatedUser } from '../../src/auth/types/authenticatedUser';

export const VECTOR = `[${[1, ...Array(1023).fill(0)].join(',')}]`;
export const createKnowledgeTestDatabase = async () => {
  const db = new PGlite({ extensions: { vector, pgcrypto } });
  await db.waitReady;
  try {
    const directory = join(__dirname, '../../db/migrations');
    const migrations = readdirSync(directory)
      .filter((file) => file.endsWith('.sql'))
      .sort();
    for (const file of migrations.filter((file) => file < '0084'))
      await db.exec(readFileSync(join(directory, file), 'utf8'));
    const tenantId = randomUUID();
    const otherTenantId = randomUUID();
    const adminId = randomUUID();
    const userId = randomUUID();
    await db.query(
      `INSERT INTO tenants(id,name,slug,status) VALUES($1,'Client','test-client','active'),($2,'QuipTech','test-platform','active')`,
      [tenantId, otherTenantId],
    );
    await db.query(
      `INSERT INTO users(id,tenant_id,email,first_name,last_name,password_hash) VALUES($1,$2,'client@test.invalid','Client','User','test'),($3,$4,'owner@test.invalid','Platform','Owner','test')`,
      [userId, tenantId, adminId, otherTenantId],
    );
    await db.query(
      `INSERT INTO user_roles(tenant_id,user_id,role_id) SELECT $1,$2,id FROM roles WHERE name='Owner' AND is_system_role`,
      [otherTenantId, adminId],
    );
    const actor: AuthenticatedUser = {
      tenantId,
      userId,
      email: 'client@test.invalid',
    };
    const admin: AuthenticatedUser = {
      tenantId: otherTenantId,
      userId: adminId,
      email: 'owner@test.invalid',
    };
    const legacy = {
      itemId: randomUUID(),
      documentId: randomUUID(),
      versionId: randomUUID(),
    };
    await db.query(
      `SELECT admin_create_knowledge_upload(NULL,$1,$2,$3,'Legacy manual','manual',$4,'legacy.pdf','application/pdf',50,'test-bucket','documents/shared/legacy/v1/legacy.pdf')`,
      [legacy.itemId, legacy.documentId, legacy.versionId, adminId],
    );
    await db.query(
      `UPDATE document_versions SET ingestion_status='ready' WHERE id=$1`,
      [legacy.versionId],
    );
    await db.query(`UPDATE documents SET live_version_id=$1 WHERE id=$2`, [
      legacy.versionId,
      legacy.documentId,
    ]);
    await db.query(
      `UPDATE knowledge_items SET status='published' WHERE id=$1`,
      [legacy.itemId],
    );
    await db.query(
      `INSERT INTO document_chunks(document_id,document_version_id,chunk_text,embedding,chunk_index)
      VALUES($1,$2,'Legacy hydraulic manual',$3::vector,0)`,
      [legacy.documentId, legacy.versionId, VECTOR],
    );
    for (const file of migrations.filter((file) => file >= '0084'))
      await db.exec(readFileSync(join(directory, file), 'utf8'));
    const query = async (sql: string, params: unknown[] = []) => {
      const result = await db.query(sql, params);
      return {
        rows: result.rows,
        rowCount: Math.max(result.affectedRows ?? 0, result.rows.length),
      };
    };
    const withActor = async <T>(
      person: Pick<AuthenticatedUser, 'tenantId' | 'userId'>,
      work: (client: { query: typeof query }) => Promise<T>,
    ): Promise<T> => {
      await db.exec('SAVEPOINT actor_work');
      await db.exec('SET LOCAL ROLE field_app');
      await db.query(
        `SELECT set_config('app.tenant_id',$1,true),set_config('app.user_id',$2,true)`,
        [person.tenantId, person.userId],
      );
      try {
        const result = await work({ query });
        await db.exec('RESET ROLE; RELEASE SAVEPOINT actor_work');
        return result;
      } catch (error) {
        await db.exec(
          'ROLLBACK TO SAVEPOINT actor_work; RELEASE SAVEPOINT actor_work',
        );
        throw error;
      }
    };
    const database = {
      query,
      withActor,
      withTenant: async (
        id: string,
        work: (client: { query: typeof query }) => Promise<unknown>,
      ) => withActor({ tenantId: id, userId: actor.userId }, work),
    } as unknown as DatabaseService;
    const brand = async (name: string) => {
      const id = randomUUID();
      const categoryId = randomUUID();
      await db.query(
        'INSERT INTO knowledge_brands(id,name,slug) VALUES($1,$2,$3)',
        [id, name, name.toLowerCase()],
      );
      await db.query(
        "INSERT INTO knowledge_categories(id,brand_id,name,slug) VALUES($1,$2,'Maintenance','maintenance')",
        [categoryId, id],
      );
      return { id, categoryId };
    };
    const document = async (
      name: string,
      brandId: string,
      categoryId: string,
    ) => {
      const itemId = randomUUID();
      const documentId = randomUUID();
      const versionId = randomUUID();
      await db.query(
        `INSERT INTO knowledge_items(id,tenant_id,title,type,status,source_type,created_by) VALUES($1,NULL,$2,'manual','published','internal',$3)`,
        [itemId, name, adminId],
      );
      await db.query(
        `INSERT INTO documents(id,knowledge_item_id,brand_id,category_id,document_type) VALUES($1,$2,$3,$4,'manual')`,
        [documentId, itemId, brandId, categoryId],
      );
      const key = `knowledge/brands/${brandId}/${categoryId}/${documentId}/v1/manual.pdf`;
      await db.query(
        `INSERT INTO document_versions(id,document_id,file_url,version_number,uploaded_by,ingestion_status,storage_bucket,storage_key,file_name,content_type) VALUES($1,$2,$3,1,$4,'ready','test-bucket',$5,'manual.pdf','application/pdf')`,
        [versionId, documentId, `s3://test-bucket/${key}`, adminId, key],
      );
      await db.query('UPDATE documents SET live_version_id=$1 WHERE id=$2', [
        versionId,
        documentId,
      ]);
      await db.query(
        `INSERT INTO document_chunks(document_id,document_version_id,chunk_text,embedding,chunk_index,page_number) VALUES($1,$2,$3,$4::vector,0,1)`,
        [documentId, versionId, `${name} hydraulic calibration`, VECTOR],
      );
      return { itemId, documentId, versionId, key };
    };
    return { db, database, actor, admin, legacy, brand, document };
  } catch (error) {
    await db.close();
    throw error;
  }
};
