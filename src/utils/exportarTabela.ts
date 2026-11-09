/**
 * Planilha de qualquer lista do sistema (botão "Baixar planilha" do rodapé
 * da TabelaPadrao). Sai em CSV com ponto e vírgula, vírgula decimal e marca
 * UTF-8 no começo: é o formato que o Excel em português abre direto, com
 * acento certo e número que dá para somar.
 */

export type ValorCelula = string | number | boolean | null | undefined;

export interface ColunaExportavel<T> {
  titulo: string;
  valor: (linha: T) => ValorCelula;
}

const numeroPtBr = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6, useGrouping: false });

/** Texto de uma célula: número com vírgula, vazio para ausente, sim/não para marcação. */
export const textoDaCelula = (valor: ValorCelula): string => {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return Number.isFinite(valor) ? numeroPtBr.format(valor) : '';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  return valor.replace(/\s+/g, ' ').trim();
};

const protegido = (texto: string) => (/[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto);

/** Monta o CSV (sem a marca UTF-8) com o cabeçalho e uma linha por registro. */
export const tabelaParaCsv = <T,>(linhas: readonly T[], colunas: readonly ColunaExportavel<T>[]): string => {
  const cabecalho = colunas.map(coluna => protegido(coluna.titulo)).join(';');
  const corpo = linhas.map(linha => colunas.map(coluna => protegido(textoDaCelula(coluna.valor(linha)))).join(';'));
  return [cabecalho, ...corpo].join('\r\n');
};

/** Nome de arquivo sem acento nem espaço, com a data do dia: "colaboradores-2026-11-09.csv". */
export const nomeDoArquivo = (titulo: string, dia: string): string => {
  const base = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'lista';
  return `${base}-${dia}.csv`;
};
