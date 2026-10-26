import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';

type Client = Pick<PoolClient, 'query'>;

export interface BiometricKeyLookupRow {
  id: string;
  tenant_id: string;
  user_id: string;
  public_key: Uint8Array;
  device_type: string;
  user_status: string;
  tenant_status: string;
}

export interface BiometricKey {
  id: string;
  deviceType: string;
  appVersion: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

const keyColumns = `id,device_type AS "deviceType",app_version AS "appVersion",
  created_at AS "createdAt",last_used_at AS "lastUsedAt"`;

// The most phones one person can have; registering one more drops the oldest.
const MAX_KEYS_PER_USER = 10;

// Before sign-in, outside any tenant: SECURITY DEFINER functions (0111).
export const lookupBiometricKey = async (
  database: DatabaseService,
  keyId: string,
) =>
  (
    await database.query<BiometricKeyLookupRow>(
      'SELECT * FROM auth_lookup_biometric_key($1)',
      [keyId],
    )
  ).rows[0] ?? null;

export const issueChallenge = async (
  database: DatabaseService,
  keyId: string,
  challenge: string,
) =>
  (
    await database.query<{ id: string; expires_at: Date }>(
      'SELECT * FROM biometric_issue_challenge($1,$2)',
      [keyId, challenge],
    )
  ).rows[0];

// Single use: the challenge is deleted as it is read.
export const takeChallenge = async (
  database: DatabaseService,
  challengeId: string,
  keyId: string,
) =>
  (
    await database.query<{ challenge: string | null }>(
      'SELECT biometric_take_challenge($1,$2) AS challenge',
      [challengeId, keyId],
    )
  ).rows[0]?.challenge ?? null;

export const recordFailedSignIn = async (
  database: DatabaseService,
  keyId: string,
  ip: string | null,
) => {
  await database.query('SELECT biometric_record_failure($1,$2)', [keyId, ip]);
};

// The rest run inside withActor: RLS limits them to the actor's own keys.
export const selectBiometricKeys = async (client: Client) =>
  (
    await client.query<BiometricKey>(
      `SELECT ${keyColumns} FROM biometric_keys WHERE revoked_at IS NULL
       ORDER BY created_at DESC`,
    )
  ).rows;

export const insertBiometricKey = async (
  client: Client,
  key: {
    tenantId: string;
    userId: string;
    algorithm: string;
    publicKey: Buffer;
    deviceType: string;
    appVersion: string | null;
  },
) => {
  await client.query(
    `DELETE FROM biometric_keys WHERE id IN
       (SELECT id FROM biometric_keys ORDER BY created_at DESC OFFSET $1)`,
    [MAX_KEYS_PER_USER - 1],
  );
  return (
    await client.query<BiometricKey>(
      `INSERT INTO biometric_keys
        (tenant_id,user_id,algorithm,public_key,device_type,app_version)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${keyColumns}`,
      [
        key.tenantId,
        key.userId,
        key.algorithm,
        key.publicKey,
        key.deviceType,
        key.appVersion,
      ],
    )
  ).rows[0];
};

export const deleteBiometricKey = async (client: Client, id: string) =>
  ((await client.query('DELETE FROM biometric_keys WHERE id=$1', [id]))
    .rowCount ?? 0) > 0;

export const recordBiometricKeyUse = async (client: Client, id: string) => {
  await client.query(
    `UPDATE biometric_keys SET last_used_at=now(),failed_attempts=0,updated_at=now()
     WHERE id=$1`,
    [id],
  );
};
