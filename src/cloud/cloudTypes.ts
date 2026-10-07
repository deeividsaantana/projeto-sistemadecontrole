import type { CloudBaseline } from '../cloudMerge';

export type CloudData = Record<string, unknown>;

export interface CloudConnectionStatus {
  connected: boolean;
  updatedAt: string;
  schemaVersion: number;
}

export interface CloudUploadResult {
  updatedAt: string;
  totalRecords: number;
  writtenDocuments: number;
  reusedDocuments: number;
  publishedBaseline?: CloudBaseline;
}

export interface CloudDownloadResult {
  data: CloudData | null;
  source: 'supabase' | 'none';
  updatedAt: string;
  totalRecords: number;
}
