import { getSupabaseClient } from '../supabase/client';
import {
  buildOperationalAttachmentPath,
  type OperationalAttachmentScope,
  validateOperationalAttachment,
} from '../utils/operationalAttachmentRules';

export {
  buildOperationalAttachmentPath,
  isAllowedOperationalAttachment,
  MAX_OPERATIONAL_ATTACHMENT_BYTES,
  validateOperationalAttachment,
} from '../utils/operationalAttachmentRules';

export type StoredOperationalAttachment = OperationalAttachmentScope & {
  path: string;
  name: string;
  contentType: string;
  size: number;
};

const safeFileName = (value: string) => {
  const normalized = String(value || '').trim()
    .replace(/[\\/]+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 160);
  if (!normalized || normalized === '.' || normalized === '..') throw new Error('Nome de arquivo inválido.');
  return normalized;
};

const getOperationalAttachmentsBucket = () => String(
  import.meta.env.VITE_SUPABASE_OPERATIONAL_ATTACHMENTS_BUCKET || 'operational-attachments',
).trim();

const normalizeSupabaseStorageError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(String((error as { message?: unknown }).message || 'Falha no Supabase Storage.'));
  }
  return new Error(String(error || 'Falha no Supabase Storage.'));
};

export const uploadOperationalAttachment = async (
  scope: OperationalAttachmentScope,
  file: File,
): Promise<StoredOperationalAttachment> => {
  validateOperationalAttachment(file);
  const path = buildOperationalAttachmentPath(scope, file.name);
  const { error } = await getSupabaseClient().storage
    .from(getOperationalAttachmentsBucket())
    .upload(path, file, {
      upsert: true,
      cacheControl: '3600',
      contentType: file.type,
      metadata: {
        originalName: safeFileName(file.name),
        module: scope.module,
        recordId: scope.recordId,
      },
    });
  if (error) throw normalizeSupabaseStorageError(error);
  return {
    ...scope,
    path,
    name: safeFileName(file.name),
    contentType: file.type,
    size: file.size,
  };
};

export const readOperationalAttachment = async (path: string): Promise<Blob> => {
  const { data, error } = await getSupabaseClient().storage
    .from(getOperationalAttachmentsBucket())
    .download(String(path || ''));
  if (error) throw normalizeSupabaseStorageError(error);
  if (!data) throw new Error('Anexo operacional não encontrado no Supabase Storage.');
  return data;
};
