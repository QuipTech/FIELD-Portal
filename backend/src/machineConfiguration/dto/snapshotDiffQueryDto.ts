import { IsIn, IsUUID } from 'class-validator';

// Either order works; the diff always reads older → newer.
export class SnapshotDiffQueryDto {
  @IsUUID()
  from: string;

  @IsUUID()
  to: string;
}

export class ExportSnapshotDiffQueryDto extends SnapshotDiffQueryDto {
  @IsIn(['csv', 'pdf'])
  format: 'csv' | 'pdf';
}
