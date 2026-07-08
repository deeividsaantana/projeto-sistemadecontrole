const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const FIREBASE_SERVICE_ACCOUNT_KEY = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://sistemarenea-default-rtdb.firebaseio.com';
const MANUTENCAO_SOURCE_URL = process.env.MANUTENCAO_SOURCE_URL || 'https://dynamic-manatee-66561d.netlify.app/';

function getServiceAccount() {
  if (!FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error('Variável FIREBASE_SERVICE_ACCOUNT_KEY não configurada no Netlify.');
  }

  try {
    return JSON.parse(FIREBASE_SERVICE_ACCOUNT_KEY);
  } catch (error) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY inválida: ${error.message}`);
  }
}

function getDb() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(getServiceAccount()),
      databaseURL: FIREBASE_DATABASE_URL,
    });
  }

  return getFirestore();
}

function numberFromNearbyLabel(html, labels) {
  for (const label of labels) {
    const labelPattern = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const before = new RegExp(`(?:${labelPattern})[\\s\\S]{0,500}?(?:>|\\s)(\\d{1,5})(?:<|\\s)`, 'i');
    const after = new RegExp(`(?:>|\\s)(\\d{1,5})(?:<|\\s)[\\s\\S]{0,500}?(?:${labelPattern})`, 'i');
    const match = html.match(before) || html.match(after);

    if (match) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value)) return value;
    }
  }

  return null;
}

function safeNumbers(html) {
  const values = [];
  const matches = html.matchAll(/>(\d{1,5})</g);

  for (const match of matches) {
    const value = Number.parseInt(match[1], 10);
    if (Number.isFinite(value) && value >= 0 && value <= 99999) {
      values.push(value);
    }
  }

  return values;
}

async function fetchDados() {
  const response = await fetch(MANUTENCAO_SOURCE_URL, {
    headers: {
      'User-Agent': 'SistemaRenea-Sync/1.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar site externo: HTTP ${response.status}`);
  }

  const html = await response.text();
  const fallbackNumbers = safeNumbers(html);
  const disponibilidadeMatch = html.match(/(?:>|\s)(\d{1,3})%/);

  let total = numberFromNearbyLabel(html, ['TOTAL', 'EQUIPAMENTOS', 'FROTA']);
  let operando = numberFromNearbyLabel(html, ['OPERANDO', 'OPERAÇÃO', 'OPERACAO', 'ATIVO']);
  let mobilizacao = numberFromNearbyLabel(html, ['MOBILIZAÇÃO', 'MOBILIZACAO', 'DESLOCAMENTO']);
  let manutencao = numberFromNearbyLabel(html, ['MANUTENÇÃO', 'MANUTENCAO', 'OFICINA', 'REPARO']);
  let paradas = numberFromNearbyLabel(html, ['PARADAS', 'PARADO', 'INATIVO', 'SEM OPERAÇÃO', 'SEM OPERACAO']);

  if (fallbackNumbers.length >= 5) {
    total ??= fallbackNumbers[0];
    operando ??= fallbackNumbers[1];
    mobilizacao ??= fallbackNumbers[2];
    manutencao ??= fallbackNumbers[3];
    paradas ??= fallbackNumbers[4];
  }

  return {
    total,
    operando,
    mobilizacao,
    manutencao,
    paradas,
    disponibilidade: disponibilidadeMatch ? Number.parseInt(disponibilidadeMatch[1], 10) : null,
    fonte: MANUTENCAO_SOURCE_URL,
    atualizadoEm: new Date().toISOString(),
  };
}

exports.handler = async () => {
  try {
    const dados = await fetchDados();

    await getDb()
      .collection('sistemarenea_cloud')
      .doc('equipamentos_externos')
      .set(dados, { merge: true });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, dados }),
    };
  } catch (error) {
    console.error('Erro na sincronização de manutenção:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, erro: error.message }),
    };
  }
};
