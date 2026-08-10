import assert from 'node:assert/strict';
import {
  buildOperationalAttachmentPath,
  isAllowedOperationalAttachment,
  MAX_OPERATIONAL_ATTACHMENT_BYTES,
  validateOperationalAttachment,
} from '../src/utils/operationalAttachmentRules';

assert.equal(
  buildOperationalAttachmentPath(
    { obraId: 'obra 01', module: 'materiais', recordId: 'nf/123' },
    'Nota Fiscal 001.pdf',
  ),
  'obras/obra_01/materiais/nf_123/Nota_Fiscal_001.pdf',
);
assert.equal(isAllowedOperationalAttachment('image/jpeg'), true);
assert.equal(isAllowedOperationalAttachment('application/pdf'), true);
assert.equal(isAllowedOperationalAttachment('application/x-msdownload'), false);
assert.throws(
  () => validateOperationalAttachment({ name: 'grande.pdf', type: 'application/pdf', size: MAX_OPERATIONAL_ATTACHMENT_BYTES }),
  /10 MB/,
);
