import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const publicAppSource = readFileSync(new URL('../src/PublicLinksApp.tsx', import.meta.url), 'utf8');
const publicPresenceSource = readFileSync(new URL('../src/components/PresencaTempoRealPublica.tsx', import.meta.url), 'utf8');
const adminPresenceSource = readFileSync(new URL('../src/components/ControlePresencaTab.tsx', import.meta.url), 'utf8');
const subscriptionSource = readFileSync(new URL('../src/firebasePublicSubmissions.ts', import.meta.url), 'utf8');
const functionSource = readFileSync(new URL('../netlify/functions/public-presenca.js', import.meta.url), 'utf8');

test('presenca usa somente os componentes novos e remove camadas antigas', () => {
  assert.match(publicAppSource, /PresencaTempoRealPublica/);
  assert.doesNotMatch(publicAppSource, /PresencaLinkExterno/);
  assert.doesNotMatch(appSource, /components\/PresencaUnificada|components\/PresencaTab'/);
  assert.doesNotMatch(adminPresenceSource, /Integração externa|Presença diária|dark:/);
});

test('link publico exige revisao explicita de todos os colaboradores', () => {
  assert.match(publicPresenceSource, /const pending = Math\.max\(0, groupEmployees\.length - reviewed\)/);
  assert.match(publicPresenceSource, /if \(pending > 0\)/);
  assert.match(publicPresenceSource, /disabled=\{submitting \|\| savingDraft \|\| pending > 0\}/);
  assert.doesNotMatch(publicPresenceSource, /status:\s*'Presente'/);
});

test('envios publicos entram no painel por assinatura em tempo real', () => {
  assert.match(subscriptionSource, /onSnapshot\(/);
  assert.doesNotMatch(subscriptionSource, /getDocs|setInterval/);
  assert.match(appSource, /subscribePendingPublicSubmissions/);
  assert.match(appSource, /writeStorageValue\(localStorage, 'renea_history_logs', JSON\.stringify\(nextHistory\)\)/);
});

test('servico publico reutiliza leitura curta e devolve comprovante do envio', () => {
  assert.match(functionSource, /SNAPSHOT_CACHE_TTL_MS = 3000/);
  assert.match(functionSource, /resolveGroupEmployeeIds/);
  assert.match(functionSource, /data: \{ submissionId, createdAtIso \}/);
  assert.match(functionSource, /Cache-Control.*no-store/);
});

test('situacao diaria oferece PDF e Excel e oculta equipes ja enviadas', () => {
  assert.match(adminPresenceSource, /Relatório da situação do dia/);
  assert.match(adminPresenceSource, /exportDailyExcel/);
  assert.match(adminPresenceSource, /exportDailyPdf/);
  assert.match(functionSource, /loadSubmittedGroupIds/);
  assert.match(functionSource, /filterSubmittedGroups/);
  assert.match(publicPresenceSource, /Todas as equipes já enviaram a presença de hoje/);
});

test('apontador salva rascunho local sem transmitir ao painel', () => {
  assert.match(publicPresenceSource, /const saveDraft = async \(\) =>/);
  assert.match(publicPresenceSource, /Rascunho salvo neste aparelho · Ainda não enviado/);
  assert.match(publicPresenceSource, /type="button" onClick=\{\(\) => void saveDraft\(\)\}/);
  assert.match(publicPresenceSource, /savingDraft \? <RefreshCw className="h-5 w-5 animate-spin" \/> : draftSaved/);
  assert.match(publicPresenceSource, /draftSaved \? <CheckCircle2 className="h-5 w-5" \/> : <Save/);
  assert.match(publicPresenceSource, /savingDraft \? 'Salvando' : draftSaved \? 'Rascunho salvo' : 'Salvar rascunho'/);
  assert.match(publicPresenceSource, /showDraftSuccessScreen && group/);
  assert.match(publicPresenceSource, /<h1>Rascunho salvo<\/h1>/);
  assert.match(publicPresenceSource, /Este rascunho ainda não foi enviado para o controle de presença/);
  assert.match(publicPresenceSource, /type="submit"/);
  assert.match(publicPresenceSource, /'Enviar presença'/);
});
