import {
  getBlob,
  ref,
  uploadBytes,
  type StorageReference,
} from 'firebase/storage';
import { storage } from '../firebaseStorage';
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

export const uploadOperationalAttachment = async (
  scope: OperationalAttachmentScope,
  file: File,
): Promise<StoredOperationalAttachment> => {
  validateOperationalAttachment(file);
  const path = buildOperationalAttachmentPath(scope, file.name);
  const reference = ref(storage, path);
  await uploadBytes(reference, file, {
    contentType: file.type,
    customMetadata: {
      originalName: safeFileName(file.name),
      module: scope.module,
      recordId: scope.recordId,
    },
  });
  return {
    ...scope,
    path,
    name: safeFileName(file.name),
    contentType: file.type,
    size: file.size,
  };
};

export const readOperationalAttachment = async (path: string): Promise<Blob> => {
  const reference: StorageReference = ref(storage, String(path || ''));
  return getBlob(reference);
};
