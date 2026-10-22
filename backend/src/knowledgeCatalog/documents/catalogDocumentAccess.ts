import { ConflictException, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { KnowledgeAccess, assertCanOpenBrand } from '../access/knowledgeAccess';
import { CatalogDocumentRow } from '../types/catalogRows';
import { findCatalogDocument } from './catalogDocuments.repository';

const NOT_FOUND_MESSAGE = 'Document not found.';
const NOT_READABLE_MESSAGE = "This document doesn't have a live version yet.";

const isReadable = (row: CatalogDocumentRow): boolean =>
  row.live_version_id !== null &&
  !['archived', 'withdrawn'].includes(row.status);

// 404 for anything the caller can't see (another organisation's, or not
// live for a non-admin), so ids give nothing away; 403 only when the
// document is visible but its brand isn't in the plan.
export const loadVisibleDocument = async (
  client: PoolClient,
  access: KnowledgeAccess,
  itemId: string,
): Promise<CatalogDocumentRow> => {
  const row = await findCatalogDocument(client, access.tenantId, itemId);
  if (!row || (!access.isAdmin && !isReadable(row))) {
    throw new NotFoundException(NOT_FOUND_MESSAGE);
  }
  assertCanOpenBrand(access, row.brand_id);
  return row;
};

// For pages and the file: admins can see a document that isn't live yet,
// but there's no live version to read.
export const loadReadableDocument = async (
  client: PoolClient,
  access: KnowledgeAccess,
  itemId: string,
): Promise<CatalogDocumentRow & { live_version_id: string }> => {
  const row = await loadVisibleDocument(client, access, itemId);
  if (!row.live_version_id) throw new ConflictException(NOT_READABLE_MESSAGE);
  return { ...row, live_version_id: row.live_version_id };
};
