import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { IndexingConfig } from './indexingConfig';
import * as indexingRepository from './indexingWorker.repository';
import { IndexingJob, IndexingStage } from './indexingWorker.repository';
import {
  DocumentExtractionError,
  ExtractedDocument,
  UNSUPPORTED_DOC_MESSAGE,
} from './extraction/documentBlocks';
import { extractPdf } from './extraction/pdfPageExtractor';
import { extractDocx } from './extraction/docxBlockExtractor';
import { TextractOcrService } from './extraction/textractOcr.service';
import { chunkBlocks } from './chunking/chunkDocument';
import {
  BedrockEmbedderService,
  toVectorLiteral,
} from './embedding/bedrockEmbedder.service';
import { detectMachineModels } from './machineModelDetection';
import { countDocumentPages } from '../knowledge/documentPageCounter';
import { AiPlatformUsageService } from '../aiPlatformUsage/aiPlatformUsage.service';

const PDF = 'application/pdf';
const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const CHUNK_BATCH_SIZE = 8;
// Progress bands: extracting 0–40%, embedding 45–95%.
const EXTRACT_SHARE = 40;
const EMBED_START = 45;
const EMBED_SHARE = 50;

// The job was deleted or reset while running; stop quietly.
export class IndexingCancelledError extends Error {}

// One document version: extract → (OCR) → chunk → embed → store → link
// machine models → live / needs review.
@Injectable()
export class IndexingPipelineService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly indexingConfig: IndexingConfig,
    private readonly textractOcr: TextractOcrService,
    private readonly embedder: BedrockEmbedderService,
    private readonly aiPlatformUsage: AiPlatformUsageService,
  ) {}

  // One usage row per run, also when it fails part-way: the chunks
  // embedded before the failure were still billed.
  indexVersion = async (job: IndexingJob): Promise<string> => {
    const usage = { inputTokens: 0 };
    try {
      return await this.runPipeline(job, usage);
    } finally {
      void this.aiPlatformUsage.recordUsage({
        tenantId: job.tenant_id,
        source: 'indexing',
        modelId: this.indexingConfig.embeddingModelId,
        inputTokens: usage.inputTokens,
        outputTokens: 0,
      });
    }
  };

  private runPipeline = async (
    job: IndexingJob,
    usage: { inputTokens: number },
  ): Promise<string> => {
    const report = this.progressReporter(job.version_id);
    if (Number(job.size_bytes ?? 0) > this.indexingConfig.maxIndexBytes) {
      throw new DocumentExtractionError(
        `Files over ${this.indexingConfig.maxIndexBytes / 1024 / 1024} MB can’t be indexed yet. Split the document and upload the parts.`,
      );
    }
    const bytes = await this.storageService.readObject(job.storage_key);
    const extracted = await this.extract(job, bytes, report);
    if (!extracted.blocks.some((block) => block.text.trim())) {
      throw new DocumentExtractionError(
        this.indexingConfig.isOcrEnabled
          ? 'No readable text was found in this document, even with OCR.'
          : 'This document has no text layer (it looks scanned). Enable OCR (Textract) or upload a text PDF.',
      );
    }

    await report('chunking', EXTRACT_SHARE + 3);
    const chunks = chunkBlocks(extracted.blocks);
    for (let start = 0; start < chunks.length; start += CHUNK_BATCH_SIZE) {
      const batch = chunks.slice(start, start + CHUNK_BATCH_SIZE);
      const embeddings = await Promise.all(
        batch.map(async (chunk) => {
          const result = await this.embedder.embed(
            [job.title, chunk.heading, chunk.content]
              .filter(Boolean)
              .join('\n'),
          );
          usage.inputTokens += result.inputTokens;
          return result.embedding;
        }),
      );
      await indexingRepository.insertChunks(this.databaseService, {
        versionId: job.version_id,
        firstIndex: start,
        chunks: batch.map((chunk, index) => ({
          ...chunk,
          embedding: toVectorLiteral(embeddings[index]),
        })),
      });
      await report(
        'embedding',
        EMBED_START + (EMBED_SHARE * (start + batch.length)) / chunks.length,
      );
    }

    const fullText = extracted.blocks.map((block) => block.text).join('\n');
    const models = await indexingRepository.listMachineModels(
      this.databaseService,
      job.tenant_id,
    );
    await indexingRepository.linkMachineModels(this.databaseService, {
      itemId: job.knowledge_item_id,
      matches: detectMachineModels(`${job.title}\n${fullText}`, models),
    });
    const state = await indexingRepository.completeIndexing(
      this.databaseService,
      {
        versionId: job.version_id,
        pageCount: extracted.pageCount,
      },
    );
    if (!state) throw new IndexingCancelledError();
    return state;
  };

  private extract = async (
    job: IndexingJob,
    bytes: Uint8Array,
    report: (stage: IndexingStage, progress: number) => Promise<void>,
  ): Promise<ExtractedDocument> => {
    if (job.content_type === DOCX) {
      const docx = await extractDocx(bytes);
      await report('parsing', EXTRACT_SHARE);
      return {
        ...docx,
        pageCount: await countDocumentPages(bytes, DOCX).catch(() => null),
      };
    }
    if (job.content_type !== PDF)
      throw new DocumentExtractionError(UNSUPPORTED_DOC_MESSAGE);

    const pdf = await extractPdf(bytes, (pagesDone, totalPages) =>
      report('parsing', (EXTRACT_SHARE * pagesDone) / totalPages),
    );
    if (!pdf.imageOnlyPages.length || !this.indexingConfig.isOcrEnabled)
      return pdf;
    const ocrBlocks = await this.textractOcr.ocrPages(
      job.storage_key,
      pdf.imageOnlyPages,
    );
    const blocks = [...pdf.blocks, ...ocrBlocks].sort(
      (a, b) => (a.page ?? 0) - (b.page ?? 0),
    );
    return { ...pdf, blocks };
  };

  // Writes progress at most once per whole percent; throws once the job
  // has been cancelled (deleted or reset) so the pipeline stops.
  private progressReporter = (versionId: string) => {
    let lastWritten = -1;
    let lastStage: IndexingStage | null = null;
    return async (stage: IndexingStage, progress: number): Promise<void> => {
      const rounded = Math.floor(progress);
      if (rounded === lastWritten && stage === lastStage) return;
      lastWritten = rounded;
      lastStage = stage;
      const isActive = await indexingRepository.setProgress(
        this.databaseService,
        { versionId, stage, progress: rounded },
      );
      if (!isActive) throw new IndexingCancelledError();
    };
  };
}
