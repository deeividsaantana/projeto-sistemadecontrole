/**
 * Planilha de compras (Google Planilhas) ← site Cintravyse.
 *
 * Cole este arquivo em Extensões > Apps Script da planilha de compras e
 * implante como "App da Web" (Executar como: eu · Quem pode acessar: qualquer
 * pessoa). Em Configurações do projeto > Propriedades do script, crie TOKEN
 * com o mesmo texto da variável PROCUREMENT_SHEET_WRITE_TOKEN da Render.
 *
 * O site manda linhas assim:
 *   { codigo: 'SOL-2026-0005/1', item, sc?, previsao?, nova?: { data, solicitante, unidade, quantidade } }
 *   { pedido: '101', item, sc?, previsao? }
 * Pedido aberto no site é achado pela coluna "Código do site" (criada aqui se
 * faltar); pedido que nasceu na planilha, pelo N° do pedido + Item. Linha que
 * já existe só tem SC e Previsão de entrega trocadas; linha nova entra no fim
 * com o próximo N° do pedido. Mandar a mesma coisa duas vezes não duplica.
 */

var ABA = 'Solicitações';
var LINHA_CABECALHO = 2;
var CABECALHOS = {
  data: /^data$/,
  pedido: /^n.? ?do pedido|^pedido$/,
  solicitante: /^solicitante/,
  item: /^item/,
  unidade: /^unidade/,
  quantidade: /^quantidade/,
  sc: /^solicitacao de compra|^sc\b/,
  previsao: /^previsao/,
  codigo: /^codigo do site/,
};

function normalizar_(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[°º]/g, 'o')
    .replace(/\s+/g, ' ').toLowerCase().trim();
}

function resposta_(dados) {
  return ContentService.createTextOutput(JSON.stringify(dados)).setMimeType(ContentService.MimeType.JSON);
}

function dataDe_(texto) {
  var partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto || ''));
  return partes ? new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])) : null;
}

function valorDaPrevisao_(texto) {
  return dataDe_(texto) || String(texto);
}

function colunas_(aba) {
  var ultima = Math.max(aba.getLastColumn(), 1);
  var nomes = aba.getRange(LINHA_CABECALHO, 1, 1, ultima).getValues()[0].map(normalizar_);
  var mapa = {};
  Object.keys(CABECALHOS).forEach(function (campo) {
    var indice = nomes.findIndex(function (nome) { return CABECALHOS[campo].test(nome); });
    if (indice >= 0) mapa[campo] = indice + 1;
  });
  if (!mapa.codigo) {
    mapa.codigo = ultima + 1;
    aba.getRange(LINHA_CABECALHO, mapa.codigo).setValue('Código do site');
  }
  ['pedido', 'item', 'sc', 'previsao'].forEach(function (campo) {
    if (!mapa[campo]) throw new Error('A aba "' + ABA + '" não tem a coluna de ' + campo + ' na linha ' + LINHA_CABECALHO + '.');
  });
  return mapa;
}

/** Aplica as linhas na aba. Separado do doPost para ser testado sem rede. */
function aplicarLinhas_(planilha, linhas) {
  var aba = planilha.getSheetByName(ABA);
  if (!aba) throw new Error('A planilha não tem a aba "' + ABA + '".');
  var col = colunas_(aba);
  var largura = aba.getLastColumn();
  var total = Math.max(aba.getLastRow() - LINHA_CABECALHO, 0);
  var dados = total ? aba.getRange(LINHA_CABECALHO + 1, 1, total, largura).getValues() : [];
  var maiorPedido = 0;
  var pedidoDoNumero = {};
  dados.forEach(function (linha) {
    var pedido = Number(linha[col.pedido - 1]) || 0;
    if (pedido > maiorPedido) maiorPedido = pedido;
    var codigo = String(linha[col.codigo - 1] || '');
    if (codigo) pedidoDoNumero[codigo.split('/')[0]] = pedido;
  });

  var alteradas = 0;
  var novas = 0;
  linhas.forEach(function (pedida) {
    var achadas = [];
    dados.forEach(function (linha, indice) {
      var mesma = pedida.codigo
        ? String(linha[col.codigo - 1] || '') === pedida.codigo
        : String(linha[col.pedido - 1]) === String(pedida.pedido) && normalizar_(linha[col.item - 1]) === normalizar_(pedida.item);
      if (mesma) achadas.push(indice);
    });
    if (achadas.length) {
      achadas.forEach(function (indice) {
        var numeroDaLinha = LINHA_CABECALHO + 1 + indice;
        if (pedida.sc !== undefined) { aba.getRange(numeroDaLinha, col.sc).setValue(pedida.sc); dados[indice][col.sc - 1] = pedida.sc; }
        if (pedida.previsao !== undefined) { aba.getRange(numeroDaLinha, col.previsao).setValue(valorDaPrevisao_(pedida.previsao)); dados[indice][col.previsao - 1] = pedida.previsao; }
        alteradas += 1;
      });
      return;
    }
    if (!pedida.codigo || !pedida.nova) return;
    var numero = pedida.codigo.split('/')[0];
    if (!pedidoDoNumero[numero]) { maiorPedido += 1; pedidoDoNumero[numero] = maiorPedido; }
    var nova = [];
    for (var c = 0; c < Math.max(largura, col.codigo); c += 1) nova.push('');
    if (col.data) nova[col.data - 1] = dataDe_(pedida.nova.data) || pedida.nova.data;
    nova[col.pedido - 1] = pedidoDoNumero[numero];
    if (col.solicitante) nova[col.solicitante - 1] = pedida.nova.solicitante;
    nova[col.item - 1] = pedida.item;
    if (col.unidade) nova[col.unidade - 1] = pedida.nova.unidade;
    if (col.quantidade) nova[col.quantidade - 1] = pedida.nova.quantidade;
    nova[col.sc - 1] = pedida.sc || '';
    nova[col.previsao - 1] = pedida.previsao ? valorDaPrevisao_(pedida.previsao) : '';
    nova[col.codigo - 1] = pedida.codigo;
    aba.appendRow(nova);
    dados.push(nova);
    novas += 1;
  });
  return { ok: true, alteradas: alteradas, novas: novas, pedidos: pedidoDoNumero };
}

function doPost(e) {
  var trava = LockService.getScriptLock();
  try {
    var corpo = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!token || corpo.token !== token) return resposta_({ ok: false, erro: 'Token inválido.' });
    trava.waitLock(30000);
    return resposta_(aplicarLinhas_(SpreadsheetApp.getActiveSpreadsheet(), corpo.linhas || []));
  } catch (erro) {
    return resposta_({ ok: false, erro: String(erro && erro.message || erro) });
  } finally {
    try { trava.releaseLock(); } catch (ignorado) { /* sem trava, nada a soltar */ }
  }
}
