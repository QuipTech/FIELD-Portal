import { IsString, IsUUID, MaxLength } from 'class-validator';

// The design project every "Send to tablet" version belongs to; the tablet
// shows it as the folder name under Files.
export const TABLET_FILES_PROJECT = 'Remote session files';

export class SendTabletFiles {
  // Chosen by the Portal; sending it again returns the first send.
  @IsUUID()
  sendId!: string;

  // JSON array of file names, in the order of the "files" parts. Separate
  // because multipart file names lose non-ASCII characters.
  @IsString()
  @MaxLength(12_000)
  names!: string;
}

export interface TabletFileSend {
  id: string;
  sendId: string;
  status: 'waiting' | 'downloading' | 'arrived' | 'failed';
  error: string | null;
  senderName: string | null;
  createdAt: string;
  updatedAt: string;
  files: { name: string; sizeBytes: number }[];
}
