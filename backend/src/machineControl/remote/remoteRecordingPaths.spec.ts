import { remoteSessionFolder } from './remoteRecording.service';
import { RemoteSessionRow } from './remoteSession.types';

describe('remote session storage path', () => {
  it("keeps recordings with the machine's files, by date and session id", () => {
    const row = {
      id: 'b40b5bec-cc06-42f3-bc3e-0ecb4ebcf2f2',
      tenant_id: '7fb7ff3b-0000-4000-8000-000000000001',
      machine_id: 'ee25b49d-668c-4595-bcb9-1a9d8faa61b0',
      created_at: new Date('2026-11-21T10:44:06Z'),
    } as RemoteSessionRow;
    expect(remoteSessionFolder(row)).toBe(
      'documents/7fb7ff3b-0000-4000-8000-000000000001/machines/ee25b49d-668c-4595-bcb9-1a9d8faa61b0/remote-sessions/2026-11-21_b40b5bec-cc06-42f3-bc3e-0ecb4ebcf2f2',
    );
  });
});
