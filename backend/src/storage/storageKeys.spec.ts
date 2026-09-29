import {
  buildAvatarKey,
  buildDocumentKey,
  buildMachinePhotoKey,
  buildSharedDocumentKey,
  isTenantOwnedKey,
  toSafeFileName,
} from './storageKeys';

const TENANT = '11111111-1111-1111-1111-111111111111';
const OTHER_TENANT = '22222222-2222-2222-2222-222222222222';

describe('storage keys', () => {
  it('puts each upload kind in its own folder under the tenant', () => {
    expect(buildDocumentKey(TENANT, 'Manual.pdf')).toMatch(
      new RegExp(`^documents/${TENANT}/[0-9a-f-]{36}-Manual\\.pdf$`),
    );
    expect(buildMachinePhotoKey(TENANT, 'machine-1', 'fault.jpg')).toMatch(
      new RegExp(`^photos/${TENANT}/machine-1/[0-9a-f-]{36}-fault\\.jpg$`),
    );
    expect(buildAvatarKey(TENANT, 'user-1', 'png')).toBe(
      `avatars/${TENANT}/user-1.png`,
    );
  });

  it('makes file names S3-safe', () => {
    expect(toSafeFileName('CAT 793F Service Manual (vol 1).pdf')).toBe(
      'CAT-793F-Service-Manual-vol-1.pdf',
    );
    // No path separators survive, so a name can't climb out of its folder.
    expect(toSafeFileName('../../etc/passwd')).not.toContain('/');
    expect(toSafeFileName('***')).toBe('file');
  });
});

describe('isTenantOwnedKey', () => {
  it.each(['documents', 'photos', 'avatars'])(
    'accepts the tenant’s own %s',
    (folder) => {
      expect(isTenantOwnedKey(`${folder}/${TENANT}/x.pdf`, TENANT)).toBe(true);
    },
  );

  it('rejects another tenant’s files', () => {
    expect(isTenantOwnedKey(`documents/${OTHER_TENANT}/x.pdf`, TENANT)).toBe(
      false,
    );
  });

  it('rejects the shared library and unknown folders', () => {
    expect(
      isTenantOwnedKey(buildSharedDocumentKey('doc-1', 1, 'a.pdf'), TENANT),
    ).toBe(false);
    expect(isTenantOwnedKey(`backups/${TENANT}/db.sql`, TENANT)).toBe(false);
  });

  it('rejects path tricks and prefix look-alikes', () => {
    expect(
      isTenantOwnedKey(`documents/${TENANT}/../${OTHER_TENANT}/x.pdf`, TENANT),
    ).toBe(false);
    expect(isTenantOwnedKey(`documents/${TENANT}//x.pdf`, TENANT)).toBe(false);
    expect(isTenantOwnedKey(`documents/${TENANT}-evil/x.pdf`, TENANT)).toBe(
      false,
    );
    expect(isTenantOwnedKey(`documents/${TENANT}`, TENANT)).toBe(false);
  });
});
