import { ConflictException } from '@nestjs/common';

export const rethrowKnowledgeBrandError = (error: unknown): never => {
  const code = (error as { code?: string }).code;
  if (code === '23503')
    throw new ConflictException(
      'Choose a valid brand/parent, or move documents and remove child categories/access grants before deleting.',
    );
  if (code === '23514')
    throw new ConflictException('Category nesting cannot contain a cycle.');
  throw error;
};
