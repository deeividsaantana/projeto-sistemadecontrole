export const MAX_OPERATIONAL_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

export type OperationalAttachmentScope = {
  obraId: string;
  module: string;
  recordId: string;
};

const safeSegment = (value: string, label: string) => {
  const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  if (!normalized) throw new Error(label + ' é obrigatório.');
  return normalized;
};

const safeFileName = (value: string) => {
  const normalized = String(value || '').trim()
    .replace(/[\\/]+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 160);
  if (!normalized || normalized === '.' || normalized === '..') throw new Error('Nome de arquivo inválido.');
  return normalized;
};

export const isAllowedOperationalAttachment = (contentType: string) => (
  String(contentType || '').startsWith('image/') || ALLOWED_CONTENT_TYPES.has(String(contentType || ''))
);

export const buildOperationalAttachmentPath = (
  scope: OperationalAttachmentScope,
  name: string,
) => {
  const obraId = safeSegment(scope.obraId, 'Obra');
  const module = safeSegment(scope.module, 'Módulo');
  const recordId = safeSegment(scope.recordId, 'Registro');
  return 'obras/' + obraId + '/' + module + '/' + recordId + '/' + safeFileName(name);
};

export const validateOperationalAttachment = (file: { name: string; size: number; type: string }) => {
  if (!file || !file.name) throw new Error('Selecione um arquivo.');
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error('O arquivo está vazio ou inválido.');
  if (file.size >= MAX_OPERATIONAL_ATTACHMENT_BYTES) throw new Error('O arquivo excede o limite de 10 MB.');
  if (!isAllowedOperationalAttachment(file.type)) throw new Error('Tipo de arquivo não permitido.');
};
