// Todo PDF do sistema sai numa folha A4 só, nunca em duas ou três páginas.
// O desenho é feito numa folha bem comprida (nada quebra de página); no fim a
// folha é cortada na altura do conteúdo e o desenho todo é encolhido por igual
// para caber num A4. Relatório curto fica do tamanho de sempre; relatório
// longo fica com letra menor, mas inteiro numa folha.
import type { jsPDF } from 'jspdf';
import { loadJsPdf } from './pdfLoader';

export type OrientacaoPdf = 'portrait' | 'landscape';

const A4: Record<OrientacaoPdf, [number, number]> = { portrait: [210, 297], landscape: [297, 210] };
const PONTOS_POR_MM = 72 / 25.4;
/** Altura da folha comprida de rascunho, em mm (100 m: nenhum relatório chega perto). */
const ALTURA_RASCUNHO = 100_000;

const caixaDaPagina = (doc: jsPDF) =>
  (doc.internal as unknown as { getPageInfo: (pagina: number) => { pageContext: { mediaBox: { topRightX: number; topRightY: number } } } })
    .getPageInfo(1).pageContext.mediaBox;

const novaFolhaComprida = async (orientacao: OrientacaoPdf, largura: number, compress: boolean): Promise<jsPDF> => {
  const JsPdf = await loadJsPdf();
  const doc = new JsPdf({ orientation: orientacao, unit: 'mm', format: 'a4', compress });
  // O jsPDF limita o tamanho no construtor; a caixa da página é ajustada depois.
  const caixa = caixaDaPagina(doc);
  caixa.topRightX = largura * PONTOS_POR_MM;
  caixa.topRightY = ALTURA_RASCUNHO * PONTOS_POR_MM;
  return doc;
};

/**
 * Gera o PDF numa folha A4 só.
 * - desenhar: desenha tudo menos o rodapé e devolve onde o conteúdo termina
 *   (mm, já com a margem de baixo e o espaço do rodapé). Lê a largura em
 *   doc.internal.pageSize.getWidth() e nunca chama addPage.
 * - rodape: desenha o rodapé no fim da folha, que tem "altura" mm.
 * - alargar: quando o conteúdo passa de uma folha, desenha de novo numa folha
 *   mais larga (mesma proporção do A4), para a tabela ocupar a folha inteira
 *   em vez de virar uma tira fina no meio. Só para desenhos que usam a largura
 *   da página em vez de posições fixas.
 */
export const gerarEmUmaFolha = async (
  { orientacao, compress = true, alargar = false }: { orientacao: OrientacaoPdf; compress?: boolean; alargar?: boolean },
  desenhar: (doc: jsPDF) => number | Promise<number>,
  rodape?: (doc: jsPDF, altura: number) => void,
): Promise<jsPDF> => {
  const [larguraA4, alturaA4] = A4[orientacao];
  let largura = larguraA4;
  let doc = await novaFolhaComprida(orientacao, largura, compress);
  let fim = await desenhar(doc);
  if (alargar && fim > alturaA4) {
    largura = larguraA4 * (fim / alturaA4);
    doc = await novaFolhaComprida(orientacao, largura, compress);
    fim = await desenhar(doc);
  }
  const altura = Math.max(Math.ceil(fim), (largura * alturaA4) / larguraA4);
  rodape?.(doc, altura);

  const escala = Math.min(1, larguraA4 / largura, alturaA4 / altura);
  // Coordenadas do PDF contam de baixo para cima: o desenho foi feito com a
  // folha de 100 m, então desce (ALTURA_RASCUNHO - altura) e encolhe; o que
  // sobra dos lados fica centralizado.
  const descer = (ALTURA_RASCUNHO - altura) * PONTOS_POR_MM * escala;
  const lado = ((larguraA4 - largura * escala) * PONTOS_POR_MM) / 2;
  const pagina = (doc.internal as unknown as { pages: string[][] }).pages[1];
  pagina.unshift(`q ${escala.toFixed(6)} 0 0 ${escala.toFixed(6)} ${lado.toFixed(3)} ${(-descer).toFixed(3)} cm`);
  pagina.push('Q');
  const caixa = caixaDaPagina(doc);
  caixa.topRightX = larguraA4 * PONTOS_POR_MM;
  caixa.topRightY = alturaA4 * PONTOS_POR_MM;
  return doc;
};
