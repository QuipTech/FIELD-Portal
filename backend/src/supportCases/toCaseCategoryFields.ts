import { CreateSupportCaseDto } from './dto/createSupportCaseDto';

// The reporter's own type name is only kept for "Something else".
export const toCaseCategoryFields = (dto: CreateSupportCaseDto) => ({
  category: dto.category,
  customCategory:
    dto.category === 'other' ? (dto.customCategory ?? null) : null,
});
