// Formato das linhas da fila de revisão (renea_master_data_review_queue),
// que continua no backup e na sincronização mesmo sem a tela que a gerava.
import type { MasterDataReviewEntity } from '../services/masterDataApi';

export type MasterDataReviewStatus = 'ready' | 'matched' | 'duplicate' | 'invalid';

export interface MasterWorkbookSourceRow {
  sheetName: string;
  rowNumber: number;
  raw: Record<string, string>;
}

export interface MasterWorkbookReviewRow extends MasterWorkbookSourceRow {
  entity: MasterDataReviewEntity;
  canonicalKey: string;
  displayValue: string;
  normalized: Record<string, unknown>;
  aliases: string[];
  candidateRecordIds: string[];
  status: MasterDataReviewStatus;
  issues: string[];
  reviewNote: string;
}
