import {
  CreatePlatformEndpointCommand,
  EndpointDisabledException,
  InvalidParameterException,
  NotFoundException,
  SetEndpointAttributesCommand,
  SNSClient,
} from '@aws-sdk/client-sns';
import { PushConfig } from './pushConfig';
import { SnsPushService } from './snsPush.service';

// send's overloads make the spy's argument types unusable; widen them.
const send = jest.spyOn(SNSClient.prototype, 'send') as unknown as jest.Mock;
const service = new SnsPushService({ region: 'ap-southeast-2' } as PushConfig);
const EXISTING =
  'arn:aws:sns:ap-southeast-2:123:endpoint/APNS/field-ios-prod/abc';
const params = {
  platformApplicationArn:
    'arn:aws:sns:ap-southeast-2:123:app/APNS/field-ios-prod',
  token: 'a1b2',
  userId: 'user-1',
};

beforeEach(() => send.mockReset());

describe('SNS push endpoints', () => {
  it('creates the endpoint and always enables it again', async () => {
    send.mockResolvedValueOnce({ EndpointArn: EXISTING } as never);
    send.mockResolvedValueOnce({} as never);
    expect(await service.ensureEndpoint(params)).toBe(EXISTING);
    const [create, update] = send.mock.calls.map((call) => call[0]);
    expect(create).toBeInstanceOf(CreatePlatformEndpointCommand);
    expect(create.input).toMatchObject({
      Token: 'a1b2',
      CustomUserData: 'user-1',
    });
    expect(update).toBeInstanceOf(SetEndpointAttributesCommand);
    expect(update.input).toEqual({
      EndpointArn: EXISTING,
      Attributes: { Token: 'a1b2', Enabled: 'true', CustomUserData: 'user-1' },
    });
  });

  it('reuses an endpoint that exists with other attributes (a new user on a shared phone)', async () => {
    send.mockRejectedValueOnce(
      new InvalidParameterException({
        message: `Invalid parameter: Token Reason: Endpoint ${EXISTING} already exists with the same Token, but different attributes.`,
        $metadata: {},
      }),
    );
    send.mockResolvedValueOnce({} as never);
    expect(await service.ensureEndpoint(params)).toBe(EXISTING);
    expect(send.mock.calls[1][0].input).toMatchObject({
      EndpointArn: EXISTING,
    });
  });

  it('reports disabled and missing endpoints instead of throwing', async () => {
    send.mockRejectedValueOnce(
      new EndpointDisabledException({
        message: 'Endpoint is disabled',
        $metadata: {},
      }),
    );
    expect(await service.publish(EXISTING, '{}')).toMatchObject({
      status: 'disabled',
    });
    send.mockRejectedValueOnce(
      new NotFoundException({
        message: 'Endpoint does not exist',
        $metadata: {},
      }),
    );
    expect(await service.publish(EXISTING, '{}')).toMatchObject({
      status: 'gone',
    });
  });

  it('treats deleting a missing endpoint as done', async () => {
    send.mockRejectedValueOnce(
      new NotFoundException({
        message: 'Endpoint does not exist',
        $metadata: {},
      }),
    );
    await expect(service.deleteEndpoint(EXISTING)).resolves.toBeUndefined();
  });
});
