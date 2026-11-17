// Site → planilha de compras. O servidor repassa as linhas ao script da própria
// planilha (scripts/google-planilha-compras.gs, implantado como App da Web).
// Sem PROCUREMENT_SHEET_WRITE_URL e PROCUREMENT_SHEET_WRITE_TOKEN o envio fica desligado.

const MAX_LINHAS = 1000;
const texto = (valor, limite) => String(valor ?? '').trim().slice(0, limite);
const opcional = (valor, limite) => (valor === undefined || valor === null ? undefined : texto(valor, limite));

export const envioLigado = () => Boolean(process.env.PROCUREMENT_SHEET_WRITE_URL && process.env.PROCUREMENT_SHEET_WRITE_TOKEN);

/** Só os campos que o script entende, com tamanho limitado. Linha sem chave é descartada. */
export const linhasValidas = linhas => (Array.isArray(linhas) ? linhas : []).slice(0, MAX_LINHAS).flatMap(linha => {
  const codigo = texto(linha?.codigo, 40);
  const pedido = texto(linha?.pedido, 20);
  const item = texto(linha?.item, 300);
  if (!item || (!codigo && !pedido)) return [];
  const limpa = { ...(codigo ? { codigo } : { pedido }), item };
  const sc = opcional(linha.sc, 80);
  const previsao = opcional(linha.previsao, 20);
  if (sc !== undefined) limpa.sc = sc;
  if (previsao !== undefined) limpa.previsao = previsao;
  if (codigo && linha.nova && typeof linha.nova === 'object') {
    limpa.nova = {
      data: texto(linha.nova.data, 10),
      solicitante: texto(linha.nova.solicitante, 120),
      unidade: texto(linha.nova.unidade, 20),
      quantidade: Number(linha.nova.quantidade) || 0,
    };
  }
  return [limpa];
});

export const enviarParaPlanilha = async (linhas, {
  url = process.env.PROCUREMENT_SHEET_WRITE_URL,
  token = process.env.PROCUREMENT_SHEET_WRITE_TOKEN,
  fetcher = fetch,
} = {}) => {
  if (!url || !token) {
    const erro = new Error('Envio do site para a planilha desligado: falta configurar o script da planilha na Render.');
    erro.statusCode = 503;
    throw erro;
  }
  // O App da Web do Google responde com um redirecionamento para o resultado; o fetch segue sozinho.
  const resposta = await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, linhas }),
    redirect: 'follow',
  });
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok || !corpo?.ok) {
    const erro = new Error(`A planilha não aceitou o envio: ${corpo?.erro || `HTTP ${resposta.status}`}.`);
    erro.statusCode = 502;
    throw erro;
  }
  return { novas: Number(corpo.novas) || 0, alteradas: Number(corpo.alteradas) || 0, pedidos: corpo.pedidos || {} };
};
