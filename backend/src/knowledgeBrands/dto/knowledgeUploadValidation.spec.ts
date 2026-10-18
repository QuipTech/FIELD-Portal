import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateKnowledgeUploadDto } from '../../adminKnowledge/dto/createKnowledgeUploadDto';

const payload = {
  title: 'Service manual',
  fileName: 'manual.pdf',
  contentType: 'application/pdf',
  sizeBytes: 100,
  brandId: '11111111-1111-4111-8111-111111111111',
  categoryId: '22222222-2222-4222-8222-222222222222',
  documentType: 'manual',
};
describe('classified upload validation', () => {
  it('accepts documentType while retaining the existing type field', async () => {
    const dto = plainToInstance(CreateKnowledgeUploadDto, payload);
    expect(dto.type).toBe('manual');
    expect(await validate(dto)).toHaveLength(0);
  });
  it('requires both brand and category for every upload', async () => {
    const dto = plainToInstance(CreateKnowledgeUploadDto, {
      ...payload,
      brandId: undefined,
      categoryId: undefined,
    });
    expect((await validate(dto)).map((error) => error.property)).toEqual(
      expect.arrayContaining(['brandId', 'categoryId']),
    );
  });
});
