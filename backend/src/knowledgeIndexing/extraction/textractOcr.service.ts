import { Injectable } from '@nestjs/common';
import {
  GetDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommandOutput,
  StartDocumentTextDetectionCommand,
  TextractClient,
} from '@aws-sdk/client-textract';
import { StorageBucket } from '../../storage/storageBucket';
import { IndexingConfig } from '../indexingConfig';
import { TextBlock } from './documentBlocks';

const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 20 * 60 * 1000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// OCR for scanned (image-only) PDF pages with Amazon Textract's async API,
// which reads the file straight from S3 (multi-page PDFs need the async
// API). Only called when some pages have no text layer and
// TEXTRACT_OCR_ENABLED=true.
@Injectable()
export class TextractOcrService {
  private readonly client: TextractClient;

  constructor(
    private readonly storageBucket: StorageBucket,
    private readonly indexingConfig: IndexingConfig,
  ) {
    this.client = new TextractClient({ region: indexingConfig.bedrockRegion });
  }

  // One body block per requested page, from Textract's LINE results.
  ocrPages = async (
    storageKey: string,
    pages: number[],
  ): Promise<TextBlock[]> => {
    const { JobId } = await this.client.send(
      new StartDocumentTextDetectionCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: this.storageBucket.requireBucket(),
            Name: storageKey,
          },
        },
      }),
    );
    const wanted = new Set(pages);
    const linesByPage = new Map<number, string[]>();
    for (const result of await this.collectResults(JobId!)) {
      for (const block of result.Blocks ?? []) {
        if (
          block.BlockType !== 'LINE' ||
          !block.Page ||
          !wanted.has(block.Page) ||
          !block.Text
        )
          continue;
        linesByPage.set(block.Page, [
          ...(linesByPage.get(block.Page) ?? []),
          block.Text,
        ]);
      }
    }
    return [...linesByPage.entries()]
      .sort(([a], [b]) => a - b)
      .map(([page, lines]) => ({
        page,
        text: lines.join('\n'),
        isHeading: false,
      }));
  };

  private collectResults = async (
    jobId: string,
  ): Promise<GetDocumentTextDetectionCommandOutput[]> => {
    const startedAt = Date.now();
    for (;;) {
      const first = await this.client.send(
        new GetDocumentTextDetectionCommand({ JobId: jobId }),
      );
      if (first.JobStatus === 'FAILED')
        throw new Error(
          `Textract OCR failed: ${first.StatusMessage ?? 'unknown'}`,
        );
      if (
        first.JobStatus === 'SUCCEEDED' ||
        first.JobStatus === 'PARTIAL_SUCCESS'
      ) {
        const results = [first];
        let nextToken = first.NextToken;
        while (nextToken) {
          const next = await this.client.send(
            new GetDocumentTextDetectionCommand({
              JobId: jobId,
              NextToken: nextToken,
            }),
          );
          results.push(next);
          nextToken = next.NextToken;
        }
        return results;
      }
      if (Date.now() - startedAt > MAX_WAIT_MS)
        throw new Error('Textract OCR timed out.');
      await wait(POLL_INTERVAL_MS);
    }
  };
}
