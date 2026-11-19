import { MachineHistoryService } from '../../src/machineHistory/machineHistory.service';
import { StorageService } from '../../src/storage/storage.service';
import { MachineAppPairingService } from '../../src/machineControl/pairing/machineAppPairing.service';
import { DeviceSessionService } from '../../src/machineControl/session/deviceSession.service';
import { KvsSignalingService } from '../../src/machineControl/remote/kvsSignaling.service';
import { RemoteRecordingService } from '../../src/machineControl/remote/remoteRecording.service';
import { RemoteSessionService } from '../../src/machineControl/remote/remoteSession.service';
import * as repository from '../../src/machineControl/remote/remoteSession.repository';
import {
  BillingTestDatabase,
  createBillingTestDatabase,
} from '../billing/billingTestDatabase';
import {
  actorsOf,
  seedSharingWorld,
  SharingWorld,
} from './machineSharingFixtures';
import { recordMachineAppAnnouncements } from './machineAppAnnouncements';

// Remote support (migration 0139): Connect, Allow/Decline on the tablet,
// one open session per tablet, expiry, ending from either side or by the
// sweep, losing the pairing, the history entry, metering and recording.
describe('remote support sessions', () => {
  let fixture: BillingTestDatabase;
  let world: SharingWorld;
  let actors: ReturnType<typeof actorsOf>;
  let pairing: MachineAppPairingService;
  let devices: DeviceSessionService;
  let remote: RemoteSessionService;
  let recordings: jest.Mocked<
    Pick<
      RemoteRecordingService,
      'recordingKey' | 'createUpload' | 'uploadPart' | 'abort' | 'complete' | 'startTranscription'
    >
  >;
  const kvs = {
    requireEnabled: jest.fn(),
    isEnabled: () => true,
    region: 'ap-southeast-2',
    ensureChannel: jest.fn().mockResolvedValue('arn:aws:kinesisvideo:channel/x'),
    access: jest.fn().mockResolvedValue({
      signalingUrl: 'wss://signed',
      iceServers: [],
      expiresAt: new Date().toISOString(),
    }),
    deleteChannel: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    fixture = await createBillingTestDatabase();
    pairing = new MachineAppPairingService(fixture.database);
    devices = new DeviceSessionService(fixture.database);
    recordings = {
      recordingKey: jest.fn().mockReturnValue('documents/t/remote-sessions/m/s/recording.webm'),
      createUpload: jest.fn().mockResolvedValue('upload-1'),
      uploadPart: jest.fn().mockResolvedValue('"etag"'),
      abort: jest.fn().mockResolvedValue(undefined),
      complete: jest.fn().mockResolvedValue(undefined),
      startTranscription: jest.fn().mockResolvedValue('field-remote-job'),
    };
    remote = new RemoteSessionService(
      fixture.database,
      kvs as unknown as KvsSignalingService,
      recordings as unknown as RemoteRecordingService,
    );
  });
  afterAll(() => fixture.db.close());
  beforeEach(async () => {
    jest.clearAllMocks();
    await fixture.db.exec('BEGIN');
    world = await seedSharingWorld(fixture);
    actors = actorsOf(fixture, world);
    await fixture.query(
      'UPDATE tenants SET machine_control_enabled = true WHERE id = $1',
      [fixture.ids.customerTenant],
    );
    await recordMachineAppAnnouncements(fixture);
  });
  afterEach(() => fixture.db.exec('ROLLBACK'));

  const pairTablet = async (machineId: string) => {
    const created = await pairing.createPairingCode(actors.adminA, machineId);
    await fixture.query("SELECT set_config('app.user_id', '', true)");
    const paired = await pairing.pairDevice({ code: created.code!, platform: 'windows' });
    await devices.setTabletOnline(paired.deviceId, `socket-${paired.deviceId}`, true);
    const device = (await devices.authenticate(paired.deviceToken))!;
    return { ...paired, device };
  };

  const remoteEvents = async () => {
    const { rows } = await fixture.query(
      "SELECT payload FROM test_announced WHERE payload->>'event' LIKE 'remote:%' ORDER BY at",
    );
    return rows.map(({ payload }: { payload: { event: string; status: string; reason: string | null } }) => ({
      event: payload.event,
      status: payload.status,
      reason: payload.reason,
    }));
  };

  it('lets a tablet request help once and gives only the claimant viewer access', async () => {
    const tablet = await pairTablet(world.shared1.id);
    const dto = { requestId: '37655fcc-71ab-4387-a830-36552b35a52f', control: false };
    const request = await remote.requestHelp(tablet.device, tablet.deviceToken, dto);
    expect(request).toMatchObject({
      id: dto.requestId,
      initiatedBy: 'tablet',
      status: 'requested',
      scope: { control: false },
    });
    await expect(remote.requestHelp(tablet.device, tablet.deviceToken, dto)).resolves.toEqual(request);
    expect(await remoteEvents()).toEqual([
      { event: 'remote:help_requested', status: 'requested', reason: null },
    ]);
    await expect(remote.pendingHelp(actors.adminA, world.shared1.id)).resolves.toEqual({
      session: request,
    });
    await expect(remote.claimHelp(actors.techB, world.shared1.id, request.id))
      .rejects.toMatchObject({ status: 404 });
    await expect(remote.create(actors.adminA, world.shared1.id, {}))
      .rejects.toMatchObject({ response: { code: 'remote_session_busy' } });
    await expect(remote.decide(tablet.device, tablet.deviceToken, request.id, {
      decision: 'allow',
    })).rejects.toMatchObject({ response: { code: 'remote_session_claim_required' } });
    await expect(remote.tabletConnection(tablet.device, tablet.deviceToken, request.id))
      .rejects.toMatchObject({ response: { code: 'remote_session_not_active' } });
    await expect(remote.claimHelp(actors.adminA, world.shared2.id, request.id))
      .rejects.toMatchObject({ response: { code: 'remote_session_not_found' } });
    const active = await remote.claimHelp(actors.adminA, world.shared1.id, request.id);
    expect(active).toMatchObject({ status: 'active', scope: { control: false } });
    await expect(remote.claimHelp(actors.adminA, world.shared1.id, request.id))
      .resolves.toMatchObject({ id: request.id, status: 'active' });
    await expect(remote.pendingHelp(actors.adminA, world.shared1.id)).resolves.toEqual({
      session: null,
    });
    await expect(remote.viewerConnection(actors.adminA, world.shared1.id, request.id))
      .resolves.toMatchObject({ role: 'VIEWER', controlAllowed: false });
    await expect(remote.tabletConnection(tablet.device, tablet.deviceToken, request.id))
      .resolves.toMatchObject({ role: 'MASTER', controlAllowed: false });
    await remote.endFromTablet(tablet.device, tablet.deviceToken, request.id);
    await expect(remote.requestHelp(tablet.device, tablet.deviceToken, dto))
      .resolves.toMatchObject({ status: 'ended' });
  });

  it('refuses a claim after operator cancellation or request expiry', async () => {
    const tablet = await pairTablet(world.shared1.id);
    const first = await remote.requestHelp(tablet.device, tablet.deviceToken, {
      requestId: '37655fcc-71ab-4387-a830-36552b35a52f', control: true,
    });
    await remote.endFromTablet(tablet.device, tablet.deviceToken, first.id);
    await expect(remote.claimHelp(actors.adminA, world.shared1.id, first.id))
      .rejects.toMatchObject({ response: { code: 'remote_session_closed' } });

    const second = await remote.requestHelp(tablet.device, tablet.deviceToken, {
      requestId: '63a75307-1858-4657-a89e-141cae85531b', control: true,
    });
    await fixture.query(
      "UPDATE mc_remote_sessions SET expires_at = now() - interval '1 second' WHERE id = $1",
      [second.id],
    );
    await expect(remote.claimHelp(actors.adminA, world.shared1.id, second.id))
      .rejects.toMatchObject({ response: { code: 'remote_session_expired' } });
    await expect(remote.pendingHelp(actors.adminA, world.shared1.id)).resolves.toEqual({
      session: null,
    });
  });

  it('runs Connect → Allow → end, with history, metering and events', async () => {
    const tablet = await pairTablet(world.shared1.id);
    const requested = await remote.create(actors.adminA, world.shared1.id, {});
    expect(requested).toMatchObject({
      status: 'requested',
      scope: { view: true, control: true, record: true },
      requester: { name: expect.any(String) },
    });

    // The tablet sees it after a reconnect too.
    const current = await remote.currentForDevice(tablet.device, tablet.deviceToken);
    expect(current.session?.id).toBe(requested.id);

    const allowed = await remote.decide(tablet.device, tablet.deviceToken, requested.id, {
      decision: 'allow',
    });
    expect(allowed.status).toBe('active');
    // A retried Allow returns the same session.
    const again = await remote.decide(tablet.device, tablet.deviceToken, requested.id, {
      decision: 'allow',
    });
    expect(again).toMatchObject({ id: requested.id, status: 'active' });

    const viewer = await remote.viewerConnection(actors.adminA, world.shared1.id, requested.id);
    expect(viewer).toMatchObject({ role: 'VIEWER', signalingUrl: 'wss://signed' });
    expect(viewer.clientId).toMatch(/^viewer-/);
    const master = await remote.tabletConnection(tablet.device, tablet.deviceToken, requested.id);
    expect(master).toMatchObject({ role: 'MASTER', clientId: null, viewerClientId: viewer.clientId });
    expect(kvs.access).toHaveBeenLastCalledWith(
      expect.objectContaining({ role: 'MASTER', clientId: null }),
    );

    const ended = await remote.endFromTablet(tablet.device, tablet.deviceToken, requested.id);
    expect(ended).toMatchObject({ status: 'ended', endReason: 'tablet_ended', endedBy: 'tablet' });
    expect(kvs.deleteChannel).toHaveBeenCalledWith('arn:aws:kinesisvideo:channel/x');
    // Ending twice changes nothing.
    expect((await remote.endFromPortal(actors.adminA, world.shared1.id, requested.id)).endReason).toBe(
      'tablet_ended',
    );

    const history = await fixture.query(
      "SELECT entry_type, remote_session_id FROM technical_history_entries WHERE machine_id = $1 AND entry_type = 'remote_session'",
      [world.shared1.id],
    );
    expect(history.rows).toEqual([{ entry_type: 'remote_session', remote_session_id: requested.id }]);
    const listed = await new MachineHistoryService(
      fixture.database,
      {} as StorageService,
    ).listHistory(actors.adminA, world.shared1.id, { type: 'remote_session' } as never);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      entryType: 'remote_session',
      remoteSession: {
        id: requested.id,
        endReason: 'tablet_ended',
        recordingStatus: 'pending',
        durationSeconds: expect.any(Number),
      },
    });
    const usage = await fixture.query(
      "SELECT tenant_id, unit FROM app.usage_events WHERE event_type = 'remote.session' AND subject_id = $1",
      [requested.id],
    );
    expect(usage.rows).toEqual([{ tenant_id: fixture.ids.customerTenant, unit: 'second' }]);
    expect(await remoteEvents()).toEqual([
      { event: 'remote:requested', status: 'requested', reason: null },
      { event: 'remote:accepted', status: 'active', reason: null },
      { event: 'remote:ended', status: 'ended', reason: 'tablet_ended' },
    ]);
  });

  it('declines, and refuses a later Allow', async () => {
    const tablet = await pairTablet(world.shared1.id);
    const requested = await remote.create(actors.adminA, world.shared1.id, {});
    const declined = await remote.decide(tablet.device, tablet.deviceToken, requested.id, {
      decision: 'decline',
    });
    expect(declined).toMatchObject({ status: 'declined', endReason: 'declined' });
    await expect(
      remote.decide(tablet.device, tablet.deviceToken, requested.id, { decision: 'decline' }),
    ).resolves.toMatchObject({ status: 'declined' });
    await expect(
      remote.decide(tablet.device, tablet.deviceToken, requested.id, { decision: 'allow' }),
    ).rejects.toMatchObject({ response: { code: 'remote_session_closed' } });
    await expect(
      remote.viewerConnection(actors.adminA, world.shared1.id, requested.id),
    ).rejects.toMatchObject({ response: { code: 'remote_session_not_active' } });
    expect((await remoteEvents()).map((e) => e.event)).toEqual([
      'remote:requested',
      'remote:declined',
    ]);
    const history = await fixture.query(
      "SELECT 1 FROM technical_history_entries WHERE entry_type = 'remote_session'",
    );
    expect(history.rowCount).toBe(0);
  });

  it('expires an unanswered request and lets a new one through', async () => {
    const tablet = await pairTablet(world.shared1.id);
    const first = await remote.create(actors.adminA, world.shared1.id, {});
    await expect(remote.create(actors.adminA, world.shared1.id, {})).rejects.toMatchObject({
      response: { code: 'remote_session_busy' },
    });
    await fixture.query(
      "UPDATE mc_remote_sessions SET expires_at = now() - interval '1 second' WHERE id = $1",
      [first.id],
    );
    await expect(
      remote.decide(tablet.device, tablet.deviceToken, first.id, { decision: 'allow' }),
    ).rejects.toMatchObject({ response: { code: 'remote_session_expired' } });
    expect(await repository.sweep(fixture.database, 10, 60, 240)).toBe(1);
    expect((await remote.get(actors.adminA, world.shared1.id, first.id)).status).toBe('expired');
    const second = await remote.create(actors.adminA, world.shared1.id, {});
    expect(second.status).toBe('requested');
  });

  it('refuses an offline tablet and an unpaired machine', async () => {
    const tablet = await pairTablet(world.shared1.id);
    await devices.setTabletOnline(tablet.deviceId, `socket-${tablet.deviceId}`, false);
    await expect(remote.create(actors.adminA, world.shared1.id, {})).rejects.toMatchObject({
      response: { code: 'remote_tablet_offline' },
    });
    await expect(remote.create(actors.adminA, world.shared2.id, {})).rejects.toMatchObject({
      response: { code: 'remote_tablet_not_paired' },
    });
  });

  it("denies a tablet acting on another machine's session", async () => {
    const tabletA = await pairTablet(world.shared1.id);
    const tabletB = await pairTablet(world.shared2.id);
    const requested = await remote.create(actors.adminA, world.shared1.id, {});
    await expect(
      remote.decide(tabletB.device, tabletB.deviceToken, requested.id, { decision: 'allow' }),
    ).rejects.toMatchObject({ response: { code: 'remote_session_not_found' } });
    await expect(
      remote.endFromTablet(tabletB.device, tabletB.deviceToken, requested.id),
    ).rejects.toMatchObject({ response: { code: 'remote_session_not_found' } });
    await expect(
      remote.tabletConnection(tabletB.device, tabletB.deviceToken, requested.id),
    ).rejects.toMatchObject({ response: { code: 'remote_session_not_found' } });
    expect((await remote.currentForDevice(tabletA.device, tabletA.deviceToken)).session?.id).toBe(
      requested.id,
    );
    // Another organisation can't see it.
    await expect(remote.get(actors.techB, world.shared1.id, requested.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('ends at once when the pairing is lost, and on inactivity', async () => {
    const tablet = await pairTablet(world.shared1.id);
    const first = await remote.create(actors.adminA, world.shared1.id, {});
    await remote.decide(tablet.device, tablet.deviceToken, first.id, { decision: 'allow' });
    await fixture.query(
      "UPDATE mc_remote_sessions SET last_activity_at = now() - interval '11 minutes' WHERE id = $1",
      [first.id],
    );
    // A heartbeat without interaction doesn't count as activity.
    await remote.viewerHeartbeat(actors.adminA, world.shared1.id, first.id, false);
    await repository.sweep(fixture.database, 10, 60, 240);
    expect(await remote.get(actors.adminA, world.shared1.id, first.id)).toMatchObject({
      status: 'ended',
      endReason: 'inactive',
      endedBy: 'system',
    });

    const second = await remote.create(actors.adminA, world.shared1.id, {});
    await remote.decide(tablet.device, tablet.deviceToken, second.id, { decision: 'allow' });
    await pairing.disconnect(actors.adminA, world.shared1.id);
    expect(await remote.get(actors.adminA, world.shared1.id, second.id)).toMatchObject({
      status: 'ended',
      endReason: 'unpaired',
    });
  });

  it('keeps the recording from uploaded parts and starts transcription', async () => {
    const tablet = await pairTablet(world.shared1.id);
    const session = await remote.create(actors.adminA, world.shared1.id, {});
    await remote.decide(tablet.device, tablet.deviceToken, session.id, { decision: 'allow' });
    const part = { buffer: Buffer.alloc(1024) } as never;
    await remote.uploadRecordingPart(actors.adminA, world.shared1.id, session.id, 1, part);
    await remote.uploadRecordingPart(actors.adminA, world.shared1.id, session.id, 2, part);
    // A retried part replaces itself.
    await remote.uploadRecordingPart(actors.adminA, world.shared1.id, session.id, 2, part);
    expect(recordings.createUpload).toHaveBeenCalledTimes(1);
    await remote.endFromPortal(actors.adminA, world.shared1.id, session.id);

    const done = await remote.completeRecording(actors.adminA, world.shared1.id, session.id, false);
    expect(done).toMatchObject({
      recording: { status: 'completed' },
      transcript: { status: 'processing' },
    });
    const { rows } = await fixture.query(
      'SELECT recording_parts, recording_bytes FROM mc_remote_sessions WHERE id = $1',
      [session.id],
    );
    expect(rows[0].recording_parts.map((p: { part: number }) => p.part)).toEqual([1, 2]);
    expect(Number(rows[0].recording_bytes)).toBe(2048);
    // Finishing again changes nothing.
    await remote.completeRecording(actors.adminA, world.shared1.id, session.id, false);
    expect(recordings.complete).toHaveBeenCalledTimes(1);

    await repository.transcriptFinish(fixture.database, session.id, 'completed', 'hello there', null);
    expect(await remote.transcript(actors.adminA, world.shared1.id, session.id)).toEqual({
      status: 'completed',
      text: 'hello there',
      error: null,
    });
    // Only the requester uploads.
    await expect(
      remote.uploadRecordingPart(actors.techA, world.shared1.id, session.id, 3, part),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('fails a recording nobody uploaded', async () => {
    const tablet = await pairTablet(world.shared1.id);
    const session = await remote.create(actors.adminA, world.shared1.id, {});
    await remote.decide(tablet.device, tablet.deviceToken, session.id, { decision: 'allow' });
    await remote.endFromPortal(actors.adminA, world.shared1.id, session.id);
    const row = await remote.finishRecording(session.id, null);
    expect(row).toMatchObject({ recording_status: 'failed' });
  });
});
