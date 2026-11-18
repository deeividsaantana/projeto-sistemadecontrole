// Impressão pelo navegador (Imprimir / Salvar como PDF) sempre numa folha A4
// só e sem o endereço do site, a data e o título que o navegador põe nas
// margens. A folha não tem margem (@page margin 0, em index.css), então o
// navegador não tem onde escrever; a margem de 10 mm fica dentro da folha. Se o
// conteúdo não couber, ele é reduzido por igual (zoom) até caber.

export type OrientacaoFolha = 'retrato' | 'paisagem';

const PX_POR_MM = 96 / 25.4;
const MARGEM_MM = 10;
const TAMANHO_MM: Record<OrientacaoFolha, [number, number]> = { retrato: [210, 297], paisagem: [297, 210] };

/**
 * Deixa "folha" do tamanho de um A4 (largura cheia, margem de 10 mm por dentro)
 * e reduz o zoom até a altura caber numa folha. Mede na própria tela, então as
 * regras de "só no papel" precisam valer também enquanto a classe de impressão
 * estiver no body. Devolve uma função que desfaz tudo.
 */
export const encaixarNumaFolha = (folha: HTMLElement, orientacao: OrientacaoFolha = 'retrato', zoomMaximo = 1) => {
  const [largura, altura] = TAMANHO_MM[orientacao].map(mm => mm * PX_POR_MM);
  // Um pouco de folga: o papel arredonda diferente da tela.
  const alturaUtil = altura * 0.97;
  const estiloAntes = folha.getAttribute('style');
  const aplicar = (zoom: number) => {
    folha.style.setProperty('zoom', String(zoom));
    folha.style.setProperty('width', `${largura / zoom}px`, 'important');
    folha.style.setProperty('max-width', 'none', 'important');
    folha.style.setProperty('padding', `${(MARGEM_MM * PX_POR_MM) / zoom}px`, 'important');
    folha.style.setProperty('box-sizing', 'border-box');
  };
  const cabe = (zoom: number) => { aplicar(zoom); return folha.getBoundingClientRect().height <= alturaUtil; };
  // Reduzir o zoom alarga a folha por dentro e a tabela quebra menos linha,
  // então a altura não cai em proporção: busca o maior zoom que ainda cabe.
  let zoom = zoomMaximo;
  if (!cabe(zoom)) {
    let menor = 0.05;
    let maior = zoomMaximo;
    for (let tentativa = 0; tentativa < 12; tentativa += 1) {
      const meio = (menor + maior) / 2;
      if (cabe(meio)) menor = meio; else maior = meio;
    }
    zoom = menor;
  }
  aplicar(zoom);
  return () => {
    if (estiloAntes === null) folha.removeAttribute('style');
    else folha.setAttribute('style', estiloAntes);
  };
};

/**
 * Imprime só "folha", numa folha A4. Com "folha-imprimindo" no body, o CSS de
 * impressão (index.css) esconde o resto do sistema. "titulo" vira o nome do
 * arquivo quando a pessoa escolhe Salvar como PDF.
 */
export const imprimirEmUmaFolha = (
  folha: HTMLElement,
  { orientacao = 'retrato', titulo, zoomMaximo = 1, aoTerminar }: { orientacao?: OrientacaoFolha; titulo?: string; zoomMaximo?: number; aoTerminar?: () => void } = {},
) => {
  const tituloAntes = document.title;
  if (titulo) document.title = titulo;
  document.body.classList.add('folha-imprimindo');
  document.body.dataset.folha = orientacao;
  folha.classList.add('folha-impressa');
  const desfazer = encaixarNumaFolha(folha, orientacao, zoomMaximo);
  const limpar = () => {
    window.removeEventListener('afterprint', limpar);
    desfazer();
    folha.classList.remove('folha-impressa');
    document.body.classList.remove('folha-imprimindo');
    delete document.body.dataset.folha;
    document.title = tituloAntes;
    aoTerminar?.();
  };
  window.addEventListener('afterprint', limpar);
  window.print();
};
