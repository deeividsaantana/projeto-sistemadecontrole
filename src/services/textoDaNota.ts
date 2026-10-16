/**
 * Tira o texto de uma nota fiscal no próprio aparelho, sem serviço pago.
 * PDF digital: texto exato pelo pdf.js. PDF escaneado ou foto: leitor de
 * texto (OCR) em português, que roda no navegador. As duas bibliotecas são
 * pesadas e só carregam quando alguém abre uma nota.
 */

type Progresso = (etapa: string) => void;

const carregarPdf = async () => {
  const pdfjs = await import('pdfjs-dist');
  const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs;
};

const lerComOcr = async (imagens: Array<HTMLCanvasElement | File>, aviso: Progresso) => {
  const { createWorker } = await import('tesseract.js');
  aviso('Preparando o leitor de texto (a primeira vez demora mais)…');
  const leitor = await createWorker('por', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/',
    langPath: '/ocr/',
  });
  try {
    const textos: string[] = [];
    for (const [posicao, imagem] of imagens.entries()) {
      aviso(imagens.length > 1 ? `Lendo a página ${posicao + 1} de ${imagens.length}…` : 'Lendo a foto…');
      const { data } = await leitor.recognize(imagem);
      textos.push(data.text);
    }
    return textos.join('\n');
  } finally {
    await leitor.terminate();
  }
};

/** Junta os pedaços do pdf.js em linhas, pela altura de cada pedaço na página. */
const linhasDaPagina = (itens: Array<{ str: string; transform: number[] }>) => {
  const porAltura = new Map<number, Array<{ x: number; texto: string }>>();
  for (const item of itens) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.transform[5] / 3) * 3;
    const linha = porAltura.get(y) ?? [];
    linha.push({ x: item.transform[4], texto: item.str });
    porAltura.set(y, linha);
  }
  return [...porAltura.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, pedacos]) => pedacos.sort((a, b) => a.x - b.x).map(pedaco => pedaco.texto).join(' '));
};

const LIMITE_PAGINAS = 6;

export const textoDaNota = async (arquivo: File, aviso: Progresso = () => undefined): Promise<string> => {
  const ehPdf = arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name);
  if (!ehPdf) return lerComOcr([arquivo], aviso);

  aviso('Abrindo o PDF…');
  const pdfjs = await carregarPdf();
  const documento = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const total = Math.min(documento.numPages, LIMITE_PAGINAS);
  const linhas: string[] = [];
  for (let numero = 1; numero <= total; numero += 1) {
    const pagina = await documento.getPage(numero);
    const conteudo = await pagina.getTextContent();
    linhas.push(...linhasDaPagina(conteudo.items as Array<{ str: string; transform: number[] }>));
  }
  if (linhas.join('').replace(/\s/g, '').length > 80) return linhas.join('\n');

  // PDF sem texto: é uma nota escaneada. Desenha cada página e lê como foto.
  const telas: HTMLCanvasElement[] = [];
  for (let numero = 1; numero <= total; numero += 1) {
    const pagina = await documento.getPage(numero);
    const vista = pagina.getViewport({ scale: 2 });
    const tela = document.createElement('canvas');
    tela.width = vista.width;
    tela.height = vista.height;
    const contexto = tela.getContext('2d');
    if (!contexto) continue;
    await pagina.render({ canvasContext: contexto, viewport: vista }).promise;
    telas.push(tela);
  }
  return lerComOcr(telas, aviso);
};
