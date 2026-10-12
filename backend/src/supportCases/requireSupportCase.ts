import { NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { findCaseByNumber } from './supportCases.repository';
import { SupportCaseRow } from './types/supportCaseRows';

const CASE_NOT_FOUND_MESSAGE = 'Support case not found.';

// A case number from another organisation is "not found", never "forbidden".
export const requireSupportCase = async (
  client: PoolClient,
  tenantId: string,
  caseNumber: number,
): Promise<SupportCaseRow> => {
  const row = await findCaseByNumber(client, tenantId, caseNumber);
  if (!row) throw new NotFoundException(CASE_NOT_FOUND_MESSAGE);
  return row;
};
