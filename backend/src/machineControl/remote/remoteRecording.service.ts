import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import {
  GetTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  TranscribeClient,
} from '@aws-sdk/client-transcribe';
import { StorageBucket } from '../../storage/storageBucket';
import { StorageService } from '../../storage/storage.service';
import { RemoteSessionRow } from './remoteSession.types';

const RECORDING_CONTENT_TYPE = 'video/webm';

// Under documents/{tenantId}/, which the backend's IAM policy already
// allows; the machine's owning organisation holds it.
export const remoteSessionFolder = (row: RemoteSessionRow) =>
  `documents/${row.tenant_id}/remote-sessions/${row.machine_id}/${row.id}`;

export type TranscriptCheck =
  | { status: 'processing' }
  | { status: 'completed'; text: string }
  | { status: 'failed'; error: string };

// A session's recording: the Portal viewer records the tablet's stream and
// uploads it in parts (S3 multipart, at least 5 MiB each but the last);
// completing it starts an AWS Transcribe job whose text is kept with the
// session. Transcription is on unless REMOTE_SUPPORT_TRANSCRIBE_ENABLED=false;
// language REMOTE_SUPPORT_TRANSCRIBE_LANGUAGE (default en-AU).
@Injectable()
export class RemoteRecordingService {
  private readonly logger = new Logger(RemoteRecordingService.name);
  private readonly transcribe: TranscribeClient | null;
  private readonly language: string;

  constructor(
    private readonly bucket: StorageBucket,
    private readonly storage: StorageService,
    configService: ConfigService,
  ) {
    const region = configService.get<string>('AWS_REGION') || undefined;
    const enabled =
      configService.get<string>('REMOTE_SUPPORT_TRANSCRIBE_ENABLED') !==
      'false';
    this.transcribe =
      enabled && region ? new TranscribeClient({ region }) : null;
    this.language =
      configService.get<string>('REMOTE_SUPPORT_TRANSCRIBE_LANGUAGE') ||
      'en-AU';
  }

  recordingKey = (row: RemoteSessionRow) =>
    `${remoteSessionFolder(row)}/recording.webm`;

  createUpload = async (key: string): Promise<string> => {
    const { UploadId } = await this.bucket.requireClient().send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket.requireBucket(),
        Key: key,
        ContentType: RECORDING_CONTENT_TYPE,
      }),
    );
    if (!UploadId) throw new Error('S3 returned no upload id');
    return UploadId;
  };

  uploadPart = async (
    key: string,
    uploadId: string,
    partNumber: number,
    body: Uint8Array,
  ): Promise<string> => {
    const { ETag } = await this.bucket.requireClient().send(
      new UploadPartCommand({
        Bucket: this.bucket.requireBucket(),
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
      }),
    );
    if (!ETag) throw new Error('S3 returned no part ETag');
    return ETag;
  };

  abort = async (key: string, uploadId: string): Promise<void> => {
    await this.bucket
      .requireClient()
      .send(
        new AbortMultipartUploadCommand({
          Bucket: this.bucket.requireBucket(),
          Key: key,
          UploadId: uploadId,
        }),
      )
      .catch((error: unknown) =>
        this.logger.warn(`Abort recording upload failed: ${String(error)}`),
      );
  };

  // Completes the upload from the parts the database recorded.
  complete = async (row: RemoteSessionRow): Promise<void> => {
    const parts = [...row.recording_parts].sort((a, b) => a.part - b.part);
    await this.bucket.requireClient().send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket.requireBucket(),
        Key: row.recording_key!,
        UploadId: row.recording_upload_id!,
        MultipartUpload: {
          Parts: parts.map((part) => ({
            PartNumber: part.part,
            ETag: part.etag,
          })),
        },
      }),
    );
  };

  // The job's name, or null when transcription is off or couldn't start.
  startTranscription = async (row: RemoteSessionRow): Promise<string | null> => {
    if (!this.transcribe || !row.recording_key) return null;
    const jobName = `field-remote-${row.id}`;
    try {
      await this.transcribe.send(
        new StartTranscriptionJobCommand({
          TranscriptionJobName: jobName,
          LanguageCode: this.language as never,
          MediaFormat: 'webm',
          Media: {
            MediaFileUri: `s3://${this.bucket.requireBucket()}/${row.recording_key}`,
          },
          OutputBucketName: this.bucket.requireBucket(),
          OutputKey: `${remoteSessionFolder(row)}/transcript.json`,
        }),
      );
      return jobName;
    } catch (error) {
      if ((error as Error).name === 'ConflictException') return jobName;
      this.logger.warn(`Transcription didn't start: ${String(error)}`);
      return null;
    }
  };

  checkTranscription = async (
    row: RemoteSessionRow,
  ): Promise<TranscriptCheck> => {
    if (!this.transcribe || !row.transcript_job) {
      return { status: 'failed', error: 'Transcription is not available.' };
    }
    const { TranscriptionJob } = await this.transcribe.send(
      new GetTranscriptionJobCommand({
        TranscriptionJobName: row.transcript_job,
      }),
    );
    const status = TranscriptionJob?.TranscriptionJobStatus;
    if (status === 'FAILED') {
      return {
        status: 'failed',
        error: TranscriptionJob?.FailureReason ?? 'Transcription failed.',
      };
    }
    if (status !== 'COMPLETED') return { status: 'processing' };
    const bytes = await this.storage.readObject(
      `${remoteSessionFolder(row)}/transcript.json`,
    );
    const json = JSON.parse(Buffer.from(bytes).toString('utf8')) as {
      results?: { transcripts?: { transcript?: string }[] };
    };
    const text = (json.results?.transcripts ?? [])
      .map((item) => item.transcript ?? '')
      .join('\n')
      .trim();
    return { status: 'completed', text };
  };

  playbackUrl = (row: RemoteSessionRow) =>
    this.storage.getSignedDownloadUrl(row.recording_key!);
}
