import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { KNOWLEDGE_DOCUMENT_TYPES } from '../../knowledge/knowledgeFileRules';

export class UpdateKnowledgeDocumentDto {
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional()
  @IsIn([
    ...KNOWLEDGE_DOCUMENT_TYPES,
    'document',
    'known_issue',
    'troubleshooting_guide',
    'resolution',
  ])
  documentType?: string;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  machineModelIds?: string[];
}
