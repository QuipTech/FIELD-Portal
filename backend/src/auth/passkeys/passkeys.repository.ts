import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';

type Client = Pick<PoolClient, 'query'>;
type ChallengePurpose = 'register' | 'login';

export interface PasskeyLookupRow {
  id: string;
  tenant_id: string;
  user_id: string;
  public_key: Buffer;
  sign_count: string;
  transports: string[];
  user_status: string;
  tenant_status: string;
}

const passkeyColumns = `id,device_name AS "deviceName",backed_up AS "backedUp",
  created_at AS "createdAt",last_used_at AS "lastUsedAt"`;

// Challenges go through SECURITY DEFINER functions (no table grant), so
// these work before sign-in, outside any tenant.
export const issueChallenge = async (
  database: DatabaseService,
  purpose: ChallengePurpose,
  challenge: string,
  userId: string | null,
) =>
  (
    await database.query<{ id: string }>(
      'SELECT webauthn_issue_challenge($1,$2,$3) AS id',
      [purpose, challenge, userId],
    )
  ).rows[0].id;

// Single use: the challenge is deleted as it is read.
export const takeChallenge = async (
  database: DatabaseService,
  id: string,
  purpose: ChallengePurpose,
  userId: string | null,
) =>
  (
    await database.query<{ challenge: string | null }>(
      'SELECT webauthn_take_challenge($1,$2,$3) AS challenge',
      [id, purpose, userId],
    )
  ).rows[0]?.challenge ?? null;

export const lookupPasskey = async (
  database: DatabaseService,
  credentialId: string,
) =>
  (
    await database.query<PasskeyLookupRow>(
      'SELECT * FROM auth_lookup_passkey($1)',
      [credentialId],
    )
  ).rows[0] ?? null;

// The rest run inside withActor: RLS limits them to the actor's own passkeys.
export const selectPasskeys = async (client: Client) =>
  (
    await client.query(
      `SELECT ${passkeyColumns} FROM user_passkeys ORDER BY created_at DESC`,
    )
  ).rows;

export const selectCredentialIds = async (client: Client) =>
  (
    await client.query<{ credential_id: string; transports: string[] }>(
      'SELECT credential_id,transports FROM user_passkeys',
    )
  ).rows;

export const insertPasskey = async (
  client: Client,
  passkey: {
    tenantId: string;
    userId: string;
    credentialId: string;
    publicKey: Uint8Array;
    signCount: number;
    transports: string[];
    deviceName: string;
    backedUp: boolean;
  },
) =>
  (
    await client.query(
      `INSERT INTO user_passkeys
        (tenant_id,user_id,credential_id,public_key,sign_count,transports,device_name,backed_up)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${passkeyColumns}`,
      [
        passkey.tenantId,
        passkey.userId,
        passkey.credentialId,
        Buffer.from(passkey.publicKey),
        passkey.signCount,
        passkey.transports,
        passkey.deviceName,
        passkey.backedUp,
      ],
    )
  ).rows[0];

export const deletePasskey = async (client: Client, id: string) =>
  ((await client.query('DELETE FROM user_passkeys WHERE id=$1', [id]))
    .rowCount ?? 0) > 0;

export const recordPasskeyUse = async (
  client: Client,
  id: string,
  signCount: number,
) => {
  await client.query(
    'UPDATE user_passkeys SET sign_count=$2,last_used_at=now(),updated_at=now() WHERE id=$1',
    [id, signCount],
  );
};
