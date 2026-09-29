import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const NOT_CONFIGURED_MESSAGE =
  'File storage is not configured (S3_PORTAL_STORAGE_BUCKET, AWS_REGION).';

// The one private bucket (S3_PORTAL_STORAGE_BUCKET in AWS_REGION) and its
// client, shared by the storage services. Credentials come from the AWS
// SDK default chain.
@Injectable()
export class StorageBucket {
  private readonly bucket: string | undefined;
  private readonly client: S3Client | undefined;

  constructor(configService: ConfigService) {
    this.bucket =
      configService.get<string>('S3_PORTAL_STORAGE_BUCKET') || undefined;
    const region = configService.get<string>('AWS_REGION') || undefined;
    this.client = this.bucket && region ? new S3Client({ region }) : undefined;
  }

  // Throws 503 rather than failing at startup, so the rest of the API
  // runs in environments without storage configured.
  requireBucket = (): string => {
    if (!this.bucket || !this.client)
      throw new ServiceUnavailableException(NOT_CONFIGURED_MESSAGE);
    return this.bucket;
  };

  requireClient = (): S3Client => {
    this.requireBucket();
    return this.client!;
  };

  isConfigured = (): boolean => Boolean(this.bucket && this.client);

  putObject = async (
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void> => {
    await this.requireClient().send(
      new PutObjectCommand({
        Bucket: this.requireBucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  };
}
