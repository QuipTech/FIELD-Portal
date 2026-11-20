import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChannelRole,
  CreateSignalingChannelCommand,
  DeleteSignalingChannelCommand,
  DescribeSignalingChannelCommand,
  GetSignalingChannelEndpointCommand,
  KinesisVideoClient,
} from '@aws-sdk/client-kinesis-video';
import {
  GetIceServerConfigCommand,
  KinesisVideoSignalingClient,
} from '@aws-sdk/client-kinesis-video-signaling';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Sha256 } from '@aws-crypto/sha256-js';
import { SignatureV4 } from '@smithy/signature-v4';
import type { AwsCredentialIdentity } from '@smithy/types';
import { RemoteDebugLog, describeError } from './remoteDebugLog';

export const DEFAULT_KVS_REGION = 'ap-southeast-2';
// The presigned URL only has to open the socket.
const SIGNED_URL_SECONDS = 5 * 60;
const CHANNEL_READY_ATTEMPTS = 20;
const CHANNEL_READY_DELAY_MS = 500;
const CREDENTIAL_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export const remoteSupportUnavailable = () =>
  new ServiceUnavailableException({
    code: 'remote_support_unavailable',
    message: "Remote support isn't available right now. Please try again.",
  });

// RFC 3986, as SigV4 canonicalises query strings.
const escapeUri = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

export interface SignalingAccess {
  signalingUrl: string;
  iceServers: { urls: string[]; username?: string; credential?: string }[];
  expiresAt: string;
}

// Kinesis Video Streams WebRTC signaling for remote support, one
// SINGLE_MASTER channel per session (the tablet is MASTER, the Portal viewer
// is VIEWER). The backend signs each side's wss:// connection with its own
// AWS credentials, so neither the browser nor the tablet holds any. Needs
// REMOTE_SUPPORT_KVS_ENABLED=true; region REMOTE_SUPPORT_KVS_REGION
// (default ap-southeast-2).
@Injectable()
export class KvsSignalingService {
  private readonly logger = new Logger(KvsSignalingService.name);
  private readonly debug = new RemoteDebugLog(KvsSignalingService.name);
  private readonly enabled: boolean;
  readonly region: string;
  private readonly client: KinesisVideoClient;
  private readonly credentialProvider = defaultProvider();
  private credentials: AwsCredentialIdentity | null = null;

  constructor(configService: ConfigService) {
    this.enabled =
      configService.get<string>('REMOTE_SUPPORT_KVS_ENABLED') === 'true';
    this.region =
      configService.get<string>('REMOTE_SUPPORT_KVS_REGION') ||
      DEFAULT_KVS_REGION;
    this.client = new KinesisVideoClient({ region: this.region });
    this.debug.info('KVS config', {
      enabled: this.enabled,
      region: this.region,
    });
  }

  isEnabled = () => this.enabled;

  requireEnabled = () => {
    if (!this.enabled) {
      this.debug.warn(
        'KVS disabled: set REMOTE_SUPPORT_KVS_ENABLED=true on this API',
      );
      throw remoteSupportUnavailable();
    }
  };

  // The channel's ARN once it is ACTIVE; creating an existing one is fine.
  ensureChannel = async (channelName: string): Promise<string> => {
    this.requireEnabled();
    try {
      let arn: string | undefined;
      try {
        const created = await this.client.send(
          new CreateSignalingChannelCommand({
            ChannelName: channelName,
            ChannelType: 'SINGLE_MASTER',
            SingleMasterConfiguration: { MessageTtlSeconds: 60 },
            Tags: [{ Key: 'field:purpose', Value: 'remote-support' }],
          }),
        );
        arn = created.ChannelARN;
        this.debug.info('KVS channel created', {
          channelName,
          channelArn: arn,
        });
      } catch (error) {
        if ((error as Error).name !== 'ResourceInUseException') throw error;
        this.debug.info('KVS channel already exists', { channelName });
      }
      for (let attempt = 0; attempt < CHANNEL_READY_ATTEMPTS; attempt += 1) {
        const { ChannelInfo } = await this.client.send(
          new DescribeSignalingChannelCommand(
            arn ? { ChannelARN: arn } : { ChannelName: channelName },
          ),
        );
        arn = ChannelInfo?.ChannelARN ?? arn;
        if (ChannelInfo?.ChannelStatus === 'ACTIVE' && arn) {
          this.debug.info('KVS channel active', {
            channelName,
            channelArn: arn,
            attempts: attempt + 1,
          });
          return arn;
        }
        this.debug.info('KVS channel not active yet', {
          channelName,
          status: ChannelInfo?.ChannelStatus,
          attempt: attempt + 1,
        });
        await sleep(CHANNEL_READY_DELAY_MS);
      }
      throw new Error(`Signaling channel ${channelName} did not become active`);
    } catch (error) {
      this.logger.warn(`KVS channel unavailable: ${String(error)}`);
      this.debug.warn(
        'KVS ensureChannel FAILED (check IAM CreateSignalingChannel/DescribeSignalingChannel/TagResource and region)',
        {
          channelName,
          region: this.region,
          ...describeError(error),
        },
      );
      throw remoteSupportUnavailable();
    }
  };

  // A presigned signaling URL and ICE servers for one side.
  access = async (params: {
    channelArn: string;
    role: 'MASTER' | 'VIEWER';
    clientId: string | null;
  }): Promise<SignalingAccess> => {
    this.requireEnabled();
    try {
      const { ResourceEndpointList } = await this.client.send(
        new GetSignalingChannelEndpointCommand({
          ChannelARN: params.channelArn,
          SingleMasterChannelEndpointConfiguration: {
            Protocols: ['WSS', 'HTTPS'],
            Role: params.role as ChannelRole,
          },
        }),
      );
      const endpoint = (protocol: string) =>
        ResourceEndpointList?.find((item) => item.Protocol === protocol)
          ?.ResourceEndpoint;
      const wss = endpoint('WSS');
      const https = endpoint('HTTPS');
      this.debug.info('KVS endpoints', {
        role: params.role,
        wssHost: wss && new URL(wss).host,
        httpsHost: https && new URL(https).host,
      });
      if (!wss || !https) throw new Error('Signaling endpoints missing');

      const signaling = new KinesisVideoSignalingClient({
        region: this.region,
        endpoint: https,
      });
      const { IceServerList } = await signaling.send(
        new GetIceServerConfigCommand({
          ChannelARN: params.channelArn,
          ...(params.clientId ? { ClientId: params.clientId } : {}),
          Service: 'TURN',
        }),
      );
      const iceServers = [
        { urls: [`stun:stun.kinesisvideo.${this.region}.amazonaws.com:443`] },
        ...(IceServerList ?? []).map((server) => ({
          urls: server.Uris ?? [],
          username: server.Username,
          credential: server.Password,
        })),
      ];
      this.debug.info('KVS ICE servers', {
        role: params.role,
        clientId: params.clientId,
        stun: 1,
        turn: IceServerList?.length ?? 0,
        turnUris: (IceServerList ?? []).reduce(
          (count, server) => count + (server.Uris?.length ?? 0),
          0,
        ),
      });
      if (!IceServerList?.length) {
        this.debug.warn(
          'KVS returned no TURN servers; peers behind strict NAT/firewall will not connect',
          { role: params.role },
        );
      }
      return {
        signalingUrl: await this.presign(wss, params),
        iceServers,
        expiresAt: new Date(
          Date.now() + SIGNED_URL_SECONDS * 1000,
        ).toISOString(),
      };
    } catch (error) {
      this.logger.warn(`KVS signaling access failed: ${String(error)}`);
      this.debug.warn(
        'KVS access FAILED (check IAM GetSignalingChannelEndpoint/GetIceServerConfig/ConnectAs* and AWS credentials)',
        {
          role: params.role,
          channelArn: params.channelArn,
          ...describeError(error),
        },
      );
      throw remoteSupportUnavailable();
    }
  };

  // Deleting the channel closes both sides' signaling connections.
  deleteChannel = async (channelArn: string): Promise<void> => {
    try {
      await this.client.send(
        new DeleteSignalingChannelCommand({ ChannelARN: channelArn }),
      );
    } catch (error) {
      if ((error as Error).name === 'ResourceNotFoundException') return;
      throw error;
    }
  };

  private presign = async (
    wssEndpoint: string,
    params: {
      channelArn: string;
      role: 'MASTER' | 'VIEWER';
      clientId: string | null;
    },
  ): Promise<string> => {
    const url = new URL(wssEndpoint);
    const query: Record<string, string> = {
      'X-Amz-ChannelARN': params.channelArn,
    };
    if (params.role === 'VIEWER' && params.clientId) {
      query['X-Amz-ClientId'] = params.clientId;
    }
    const signer = new SignatureV4({
      service: 'kinesisvideo',
      region: this.region,
      credentials: this.currentCredentials,
      sha256: Sha256,
    });
    const signed = await signer.presign(
      {
        method: 'GET',
        protocol: 'wss:',
        hostname: url.hostname,
        path: url.pathname || '/',
        query,
        headers: { host: url.hostname },
      },
      { expiresIn: SIGNED_URL_SECONDS },
    );
    const search = Object.entries(signed.query ?? {})
      .map(([key, value]) => `${escapeUri(key)}=${escapeUri(String(value))}`)
      .join('&');
    return `wss://${url.hostname}${url.pathname || '/'}?${search}`;
  };

  private currentCredentials = async (): Promise<AwsCredentialIdentity> => {
    const expiration = this.credentials?.expiration?.getTime();
    if (
      !this.credentials ||
      (expiration && expiration - Date.now() < CREDENTIAL_REFRESH_MARGIN_MS)
    ) {
      this.credentials = await this.credentialProvider();
      this.debug.info('AWS credentials loaded for presigning', {
        accessKeyPrefix: this.credentials.accessKeyId.slice(0, 4),
        temporary: Boolean(this.credentials.sessionToken),
        expiresAt: this.credentials.expiration?.toISOString() ?? null,
      });
    }
    return this.credentials;
  };
}
