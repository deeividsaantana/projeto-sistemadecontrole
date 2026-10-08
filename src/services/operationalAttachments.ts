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

const bucketName = String(import.meta.env.VITE_SUPABASE_OPERATIONAL_ATTACHMENTS_BUCKET || 'operational-attachments');

const safeFileName = (value: string) => {
  const normalized = String(value || '').trim()
    .replace(/[\\/]+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 160);
  if (!normalized || normalized === '.' || normalized === '..') throw new Error('Nome de arquivo inválido.');
  return normalized;
};

export const uploadOperationalAttachment = async (
  scope: OperationalAttachmentScope,
  file: File,
): Promise<StoredOperationalAttachment> => {
  validateOperationalAttachment(file);
  const path = buildOperationalAttachmentPath(scope, file.name);
  const { error } = await getSupabaseClient().storage.from(bucketName).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return {
    ...scope,
    path,
    name: safeFileName(file.name),
    contentType: file.type,
    size: file.size,
  };
};

export const readOperationalAttachment = async (path: string): Promise<Blob> => {
  const { data, error } = await getSupabaseClient().storage.from(bucketName).download(String(path || ''));
  if (error || !data) throw error || new Error('Arquivo não encontrado no Supabase Storage.');
  return data;
};
