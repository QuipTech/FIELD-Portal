import { Injectable } from '@nestjs/common';
import {
  CreatePlatformEndpointCommand,
  DeleteEndpointCommand,
  EndpointDisabledException,
  InvalidParameterException,
  NotFoundException,
  PublishCommand,
  SetEndpointAttributesCommand,
  SNSClient,
} from '@aws-sdk/client-sns';
import { PushConfig } from './pushConfig';
import { findExistingEndpointArn } from './pushPlatform';

export type PublishOutcome =
  | { status: 'sent'; messageId: string | null }
  // SNS disabled the endpoint (APNs/FCM rejected the token); it comes back
  // when the app registers the token again.
  | { status: 'disabled'; error: string }
  | { status: 'gone'; error: string };

// The only SNS calls for push. Credentials come from the default AWS
// provider chain; the API's role needs sns:CreatePlatformEndpoint,
// SetEndpointAttributes, DeleteEndpoint and Publish.
@Injectable()
export class SnsPushService {
  private client: SNSClient | null = null;

  constructor(private readonly config: PushConfig) {}

  // The endpoint for this token, enabled and pointing at the user. Safe to
  // call on every app launch: SNS returns the same endpoint for the same
  // token, and an existing one with other attributes is reused.
  ensureEndpoint = async (params: {
    platformApplicationArn: string;
    token: string;
    userId: string;
  }): Promise<string> => {
    let endpointArn: string;
    try {
      const created = await this.getClient().send(
        new CreatePlatformEndpointCommand({
          PlatformApplicationArn: params.platformApplicationArn,
          Token: params.token,
          CustomUserData: params.userId,
        }),
      );
      endpointArn = created.EndpointArn!;
    } catch (error) {
      const existing =
        error instanceof InvalidParameterException
          ? findExistingEndpointArn(error.message)
          : null;
      if (!existing) throw error;
      endpointArn = existing;
    }
    // Always re-enable: an endpoint SNS disabled comes back to life when
    // the app sends its token again.
    await this.getClient().send(
      new SetEndpointAttributesCommand({
        EndpointArn: endpointArn,
        Attributes: {
          Token: params.token,
          Enabled: 'true',
          CustomUserData: params.userId,
        },
      }),
    );
    return endpointArn;
  };

  // Already gone counts as deleted.
  deleteEndpoint = async (endpointArn: string): Promise<void> => {
    try {
      await this.getClient().send(
        new DeleteEndpointCommand({ EndpointArn: endpointArn }),
      );
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
  };

  publish = async (
    endpointArn: string,
    message: string,
  ): Promise<PublishOutcome> => {
    try {
      const result = await this.getClient().send(
        new PublishCommand({
          TargetArn: endpointArn,
          MessageStructure: 'json',
          Message: message,
        }),
      );
      return { status: 'sent', messageId: result.MessageId ?? null };
    } catch (error) {
      if (error instanceof EndpointDisabledException)
        return { status: 'disabled', error: error.message };
      if (error instanceof NotFoundException)
        return { status: 'gone', error: error.message };
      throw error;
    }
  };

  private getClient = (): SNSClient => {
    this.client ??= new SNSClient({ region: this.config.region });
    return this.client;
  };
}
