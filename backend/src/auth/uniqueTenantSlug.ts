import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { slugify } from '../common/utils/slugify';

const MAX_ATTEMPTS = 5;

// tenants.slug is globally unique; two companies with similar names
// shouldn't fail registration, so this appends a short random suffix
// on collision instead of rejecting the request.
export const uniqueTenantSlug = async (
  databaseService: DatabaseService,
  companyName: string,
): Promise<string> => {
  const base = slugify(companyName);
  let candidate = base;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const result = await databaseService.query<{ taken: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM tenants WHERE slug = $1) AS taken',
      [candidate],
    );
    if (!result.rows[0].taken) {
      return candidate;
    }
    candidate = `${base}-${randomUUID().slice(0, 6)}`;
  }

  return candidate;
};
