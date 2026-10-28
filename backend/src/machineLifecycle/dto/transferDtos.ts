import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { trimString, trimToUndefined } from '../../common/utils/trimTransforms';
import { TransferDirection } from '../transfers/machineTransfers.repository';

const MAX_SLUG_LENGTH = 100;
const MAX_TEXT_LENGTH = 500;
const TRANSFER_DIRECTIONS: TransferDirection[] = ['incoming', 'outgoing'];

export class RequestTransferDto {
  // The receiving organisation's ID, which its administrator shares.
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SLUG_LENGTH)
  receivingOrganisationSlug: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TEXT_LENGTH)
  reason: string;
}

export class TransferDecisionDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(MAX_TEXT_LENGTH)
  note?: string;
}

export class ListTransfersQueryDto {
  @IsIn(TRANSFER_DIRECTIONS)
  direction: TransferDirection;
}
