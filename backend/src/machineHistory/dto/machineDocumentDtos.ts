import { IsIn, IsOptional, IsUUID } from 'class-validator';

export const MACHINE_DOCUMENT_TYPES = [
  'service_report',
  'inspection',
  'certificate',
  'other',
] as const;

export type MachineDocumentType = (typeof MACHINE_DOCUMENT_TYPES)[number];

// multipart/form-data fields beside `file`.
export class UploadMachineDocumentDto {
  @IsIn(MACHINE_DOCUMENT_TYPES)
  documentType!: MachineDocumentType;

  // Set when the file belongs to a history entry on this machine.
  @IsOptional()
  @IsUUID()
  historyEntryId?: string;
}

export class ListMachineDocumentsQueryDto {
  @IsOptional()
  @IsIn(MACHINE_DOCUMENT_TYPES)
  type?: MachineDocumentType;
}
