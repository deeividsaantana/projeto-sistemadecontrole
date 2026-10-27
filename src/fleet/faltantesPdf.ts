import { loadJsPdf } from '../utils/pdfLoader';
import type { ConferenciaDoDia } from './conferenciaDoDia';

export interface FaltanteEquipamento { prefixo: string; tipo: string; grupo: string }
export interface FaltanteOperador { nome: string; matricula: string }

export interface ListaFaltantes {
  data: string;
  esperadosEquipamentos: number;
  lancadosEquipamentos: number;
  equipamentos: FaltanteEquipamento[];
  esperadosOperadores: number;
  lancadosOperadores: number;
  operadores: FaltanteOperador[];
}

/** Lista pronta do PDF: só quem falta, ordenado por prefixo e por nome. */
export const montarListaFaltantes = (conferencia: ConferenciaDoDia, data: string): ListaFaltantes => ({
  data,
  esperadosEquipamentos: conferencia.equipamentos.total,
  lancadosEquipamentos: conferencia.equipamentos.informed,
  equipamentos: conferencia.equipamentos.items
    .filter(item => !item.informed)
    .map(item => ({ prefixo: item.prefix, tipo: item.equipmentType, grupo: item.group }))
    .sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR')),
  esperadosOperadores: conferencia.operadores.total,
  lancadosOperadores: conferencia.operadores.informed,
  operadores: conferencia.operadores.items
    .filter(item => !item.informed)
    .map(item => ({ nome: item.nome, matricula: item.matricula }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
});

const COR = { texto: [15, 23, 42] as [number, number, number], cinza: [91, 104, 112] as [number, number, number], ambar: [180, 83, 9] as [number, number, number], faixa: [254, 243, 199] as [number, number, number] };

/** PDF com resumo, grade de equipamentos faltantes e grade de operadores faltantes. */
export async function gerarPdfFaltantes(lista: ListaFaltantes): Promise<string> {
  const JsPdf = await loadJsPdf();
  const doc = new JsPdf({ unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const margem = 12;
  let y = margem;

  const novaPaginaSe = (altura: number) => {
    if (y + altura > doc.internal.pageSize.getHeight() - margem) {
      doc.addPage();
      y = margem;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COR.texto);
  doc.text('Faltantes do dia', margem, y + 6);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COR.cinza);
  doc.text(`Data ${lista.data.split('-').reverse().join('/')}`, margem, y + 12);
  y += 18;

  const caixas = [
    ['Equipamentos esperados', lista.esperadosEquipamentos],
    ['Equipamentos lançados', lista.lancadosEquipamentos],
    ['Equipamentos faltantes', lista.equipamentos.length],
    ['Operadores esperados', lista.esperadosOperadores],
    ['Operadores lançados', lista.lancadosOperadores],
    ['Operadores faltantes', lista.operadores.length],
  ] as const;
  const larguraCaixa = (largura - margem * 2 - 10) / 3;
  caixas.forEach(([rotulo, valor], indice) => {
    const x = margem + (indice % 3) * (larguraCaixa + 5);
    const linha = Math.floor(indice / 3);
    const yCaixa = y + linha * 20;
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(indice % 3 === 2 ? 255 : 248, 250, 252);
    doc.roundedRect(x, yCaixa, larguraCaixa, 16, 2, 2, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(...COR.cinza);
    doc.text(rotulo.toUpperCase(), x + 3, yCaixa + 5);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const corValor = indice % 3 === 2 ? COR.ambar : COR.texto;
    doc.setTextColor(corValor[0], corValor[1], corValor[2]);
    doc.text(String(valor), x + 3, yCaixa + 13);
    doc.setFont('helvetica', 'normal');
  });
  y += 42;

  const secao = (titulo: string, quantidade: number) => {
    novaPaginaSe(14);
    doc.setFillColor(...COR.faixa);
    doc.rect(margem, y, largura - margem * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COR.ambar);
    doc.text(`${titulo} (${quantidade})`, margem + 3, y + 5.5);
    y += 12;
  };

  const grade = <T,>(itens: readonly T[], cartao: (item: T) => [string, string, string], vazio: string) => {
    if (!itens.length) {
      novaPaginaSe(8);
      doc.setFontSize(10);
      doc.setTextColor(...COR.cinza);
      doc.text(vazio, margem + 2, y + 4);
      y += 10;
      return;
    }
    const colunas = 3;
    const larguraCartao = (largura - margem * 2 - 4 * (colunas - 1)) / colunas;
    itens.forEach((item, indice) => {
      if (indice % colunas === 0) novaPaginaSe(16);
      const x = margem + (indice % colunas) * (larguraCartao + 4);
      const [primeira, segunda, terceira] = cartao(item);
      doc.setDrawColor(252, 211, 77);
      doc.setFillColor(255, 251, 235);
      doc.roundedRect(x, y, larguraCartao, 14, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...COR.texto);
      doc.text(primeira, x + 3, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...COR.cinza);
      doc.text(segunda.slice(0, 40), x + 3, y + 10.5);
      if (terceira) doc.text(terceira.slice(0, 40), x + 3, y + 13.2);
      if (indice % colunas === colunas - 1 || indice === itens.length - 1) y += 17;
    });
    y += 2;
  };

  secao('Equipamentos faltantes', lista.equipamentos.length);
  grade(lista.equipamentos, item => [item.prefixo, item.tipo, item.grupo], 'Nenhum equipamento faltando.');
  y += 4;
  secao('Operadores faltantes', lista.operadores.length);
  grade(lista.operadores, item => [item.nome, `Matrícula ${item.matricula}`, ''], 'Nenhum operador faltando.');

  const nome = `FALTANTES_FROTA_${lista.data}.pdf`;
  doc.save(nome);
  return nome;
}
