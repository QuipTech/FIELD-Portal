import { BadRequestException } from '@nestjs/common';

const unsafeSegment = /[<>:"|?*\\\p{Cc}]|^ |[ .]$/u;
const reservedName =
  /^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³]|CONIN\$|CONOUT\$)(?:\.|$)/i;

export function readDesignPaths(input: string, fileCount: number): string[] {
  let paths: unknown;
  try {
    paths = JSON.parse(input);
  } catch {
    throw new BadRequestException('Invalid folder manifest.');
  }
  if (!Array.isArray(paths) || !fileCount || paths.length !== fileCount) {
    throw new BadRequestException('Provide a relative path for each file.');
  }

  const files = new Set<string>();
  const directories = new Map<string, string>();
  return paths.map((path: unknown) => {
    if (
      typeof path !== 'string' ||
      path.length > 200 ||
      path
        .split('/')
        .some(
          (segment) =>
            !segment ||
            segment === '.' ||
            segment === '..' ||
            unsafeSegment.test(segment) ||
            reservedName.test(segment),
        )
    ) {
      throw new BadRequestException(
        'Use Windows-compatible relative file paths.',
      );
    }
    const parts = path.normalize('NFC').split('/');
    for (let length = 1; length < parts.length; length++) {
      const directory = parts.slice(0, length).join('/');
      const key = directory.toLowerCase();
      const existing = directories.get(key);
      if (files.has(key) || (existing && existing !== directory)) {
        throw new BadRequestException('Folder paths conflict on Windows.');
      }
      directories.set(key, directory);
    }
    const key = parts.join('/').toLowerCase();
    if (files.has(key) || directories.has(key)) {
      throw new BadRequestException('File paths conflict on Windows.');
    }
    files.add(key);
    return parts.join('/');
  });
}
