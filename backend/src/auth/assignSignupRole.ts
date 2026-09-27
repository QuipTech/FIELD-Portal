import { InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import * as userAccessRepository from './userAccess.repository';
import { CUSTOMER_ROLE_NAME } from './systemRoleNames';

const SIGNUP_ROLE_NAME = CUSTOMER_ROLE_NAME;

// Every self-serve signup (email/password, Google, Apple) gets this role.
// Throws rather than skipping when the role is missing, so the caller's
// transaction rolls back instead of creating a user with no role at all.
export const assignSignupRole = async (
  client: PoolClient,
  params: { tenantId: string; userId: string },
): Promise<void> => {
  const roleId = await userAccessRepository.findSystemRoleIdByName(
    client,
    SIGNUP_ROLE_NAME,
  );
  if (!roleId) {
    throw new InternalServerErrorException(
      `System role "${SIGNUP_ROLE_NAME}" is missing — run migration 0027.`,
    );
  }
  await userAccessRepository.insertUserRole(client, { ...params, roleId });
};
