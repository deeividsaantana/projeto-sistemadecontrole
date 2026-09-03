// jsPDF (421 kB) e o plugin de tabelas só entram na memória quando alguém
// realmente gera um PDF. Antes, abrir qualquer tela que tivesse um botão de
// exportar já baixava a biblioteca inteira, mesmo sem ninguém clicar nela.
import type { jsPDF } from 'jspdf';

export type { jsPDF };

export const loadJsPdf = async () => (await import('jspdf')).jsPDF;

export const loadAutoTable = async () => (await import('jspdf-autotable')).default;

/** Carrega o jsPDF e o plugin juntos, no único ponto em que ambos são usados. */
export const loadPdfKit = async () => {
  const [JsPdf, autoTable] = await Promise.all([loadJsPdf(), loadAutoTable()]);
  return { JsPdf, autoTable };
};
