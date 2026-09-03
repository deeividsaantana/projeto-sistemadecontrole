import type { jsPDF } from 'jspdf';
import { loadJsPdf } from './pdfLoader';
import type { ParteDiariaEquipamento } from '../types';

export const CODIGOS_PERDA_PARTE_DIARIA = [
  ['10', 'Parada por motivo de fogo'],
  ['11', 'Falta de frente de serviço'],
  ['12', 'Falta de operador'],
  ['13', 'Almoço / jantar / lanche'],
  ['14', 'Falta de equipamento auxiliar'],
  ['15', 'DDS - Diálogo Diário de Segurança'],
  ['16', 'Mudança de local'],
  ['17', 'Locomoção por motivo de fogo'],
  ['18', 'Aguardando abastecimento / lubrificação'],
  ['19', 'Abastecendo / lubrificando'],
  ['20', 'Aguardando equipe de manutenção'],
  ['21', 'Em manutenção'],
  ['22', 'Equipamento operando acidentado'],
  ['23', 'Lavagem / limpeza do equipamento'],
  ['24', 'Chuva e consequências'],
  ['25', 'Aguardando peças'],
] as const;

export const CHECKLIST_PADRAO_PARTE_DIARIA = [
  ['01', 'Níveis de óleo / combustível?'],
  ['02', 'Nível de líquido de arrefecimento?'],
  ['03', 'Funcionamento do motor?'],
  ['04', 'Funcionamento da transmissão?'],
  ['05', 'Funcionamento do hidráulico?'],
  ['06', 'Funcionamento da direção?'],
  ['07', 'Funcionamento dos freios?'],
  ['08', 'Pneus e estepe / esteiras?'],
  ['09', 'Vazamentos?'],
  ['10', 'Trincas?'],
  ['11', 'Faróis e lanternas?'],
  ['12', 'Parafusos / apertos?'],
  ['13', 'Limpador de para-brisa?'],
  ['14', 'Retrovisor?'],
  ['15', 'Vidros e portas?'],
  ['16', 'Assento do operador?'],
  ['17', 'Cinto de segurança?'],
  ['18', 'Ar condicionado?'],
  ['19', 'Instrumentos do painel?'],
  ['20', 'Buzina e alarme de ré?'],
  ['21', 'Extintor de incêndio?'],
  ['22', 'Macaco, chave de roda e triângulo?'],
] as const;

const formatDate = (value: string) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return day && month && year ? `${day}/${month}/${year}` : value;
};

const formatNumber = (value: number, digits = 2) => (
  Number.isFinite(value)
    ? value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '0,00'
);

const fitText = (doc: jsPDF, text: string, maxWidth: number) => {
  const value = String(text || '');
  if (doc.getTextWidth(value) <= maxWidth) return value;
  let shortened = value;
  while (shortened.length > 2 && doc.getTextWidth(`${shortened}...`) > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}...`;
};

const addContainedImage = (doc: jsPDF, image: string, x: number, y: number, width: number, height: number) => {
  try {
    const properties = doc.getImageProperties(image);
    const ratio = Math.min(width / properties.width, height / properties.height);
    const renderedWidth = properties.width * ratio;
    const renderedHeight = properties.height * ratio;
    doc.addImage(
      image,
      properties.fileType || 'PNG',
      x + (width - renderedWidth) / 2,
      y + (height - renderedHeight) / 2,
      renderedWidth,
      renderedHeight,
      undefined,
      'FAST',
    );
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RENEA', x + width / 2, y + height / 2 + 2, { align: 'center' });
  }
};

const loadImageAsDataUrl = async (url: string) => {
  if (!url) return '';
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

const drawTextCell = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
) => {
  doc.rect(x, y, width, height);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.text(label.toUpperCase(), x + 1.5, y + 3.2);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(fitText(doc, value || '-', width - 3), x + 1.5, y + Math.min(height - 2, 8.7));
};

const drawTableHeader = (doc: jsPDF, labels: string[], widths: number[], x: number, y: number, height: number) => {
  let cursor = x;
  doc.setFillColor(226, 232, 240);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.3);
  labels.forEach((label, index) => {
    doc.rect(cursor, y, widths[index], height, 'FD');
    const lines = doc.splitTextToSize(label.toUpperCase(), widths[index] - 2).slice(0, 2);
    const lineHeight = 3.1;
    const offset = Math.max(2.5, (height - lines.length * lineHeight) / 2 + 2.2);
    doc.text(lines, cursor + widths[index] / 2, y + offset, { align: 'center' });
    cursor += widths[index];
  });
};

const drawActivityRows = (doc: jsPDF, record: ParteDiariaEquipamento, x: number, y: number) => {
  const widths = [8, 66, 15, 23, 25, 25, 36];
  const rowHeight = 6;
  const rows = record.atividades.slice(0, 8);
  for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
    const row = rows[rowIndex];
    const values = row ? [
      String(rowIndex + 1),
      [row.descricao, row.centroCusto].filter(Boolean).join(' / '),
      row.codigoPerda || '-',
      row.tipoMarcacao === 'Relógio' ? 'R' : 'H',
      row.inicial,
      row.final,
      formatNumber(row.totalHoras),
    ] : ['', '', '', '', '', '', ''];
    let cursor = x;
    values.forEach((value, index) => {
      doc.rect(cursor, y + rowIndex * rowHeight, widths[index], rowHeight);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(index === 1 ? 4.8 : 5.3);
      doc.setTextColor(15, 23, 42);
      doc.text(fitText(doc, value, widths[index] - 2), cursor + (index === 1 ? 1 : widths[index] / 2), y + rowIndex * rowHeight + 4, index === 1 ? undefined : { align: 'center' });
      cursor += widths[index];
    });
  }
};

const drawTransportRows = (doc: jsPDF, record: ParteDiariaEquipamento, x: number, y: number) => {
  const widths = [8, 61, 36, 37, 20, 36];
  const rowHeight = 6;
  const rows = record.transportes.slice(0, 4);
  for (let rowIndex = 0; rowIndex < 4; rowIndex += 1) {
    const row = rows[rowIndex];
    const values = row ? [
      String(rowIndex + 1),
      [row.descricao, row.centroCusto].filter(Boolean).join(' / '),
      row.destino,
      row.materialTransportado,
      String(row.quantidadeViagens || ''),
      row.equipamentoCarga,
    ] : ['', '', '', '', '', ''];
    let cursor = x;
    values.forEach((value, index) => {
      doc.rect(cursor, y + rowIndex * rowHeight, widths[index], rowHeight);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(index === 0 || index === 4 ? 5.3 : 4.8);
      doc.setTextColor(15, 23, 42);
      doc.text(fitText(doc, value, widths[index] - 2), cursor + (index === 0 || index === 4 ? widths[index] / 2 : 1), y + rowIndex * rowHeight + 4, index === 0 || index === 4 ? { align: 'center' } : undefined);
      cursor += widths[index];
    });
  }
};

const drawChecklistResponse = (doc: jsPDF, value: string, x: number, y: number) => {
  const options = ['S', 'N', '-'];
  const selected = value === 'Sim' ? 'S' : value === 'Não' ? 'N' : '-';
  options.forEach((option, index) => {
    const boxX = x + index * 7;
    doc.rect(boxX, y, 3.2, 3.2);
    if (selected === option) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.2);
      doc.text('X', boxX + 0.45, y + 2.65);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.1);
    doc.text(option, boxX + 4, y + 2.6);
  });
};

const drawMainPage = (doc: jsPDF, record: ParteDiariaEquipamento, logoDataUrl: string) => {
  const left = 6;
  const width = 198;
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.18);

  doc.rect(left, 6, width, 20);
  doc.line(left + 42, 6, left + 42, 26);
  doc.line(left + 156, 6, left + 156, 26);
  if (logoDataUrl) addContainedImage(doc, logoDataUrl, left + 3, 8, 36, 16);
  else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('RENEA', left + 21, 18, { align: 'center' });
  }
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PARTE DIÁRIA DE EQUIPAMENTOS / VEÍCULOS', left + 99, 14, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.text('Controle operacional de frota', left + 99, 19, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.text('Nº', left + 160, 11);
  doc.setFontSize(12);
  doc.text(record.numero || '-', left + 177, 19, { align: 'center' });

  drawTextCell(doc, left, 26, 100, 12, 'Obra', record.obraNome);
  drawTextCell(doc, left + 100, 26, 46, 12, 'Jornada', `${formatNumber(record.jornada)} h`);
  drawTextCell(doc, left + 146, 26, 52, 12, 'Data', formatDate(record.data));
  drawTextCell(doc, left, 38, 35, 14, 'Nº frota', record.prefixo);
  drawTextCell(doc, left + 35, 38, 63, 14, 'Tipo de equipamento / veículo', record.tipoEquipamento);
  drawTextCell(doc, left + 98, 38, 55, 14, 'Operador / motorista', record.operadorNome);
  drawTextCell(doc, left + 153, 38, 45, 14, 'Matrícula', record.matricula);
  drawTextCell(doc, left, 52, 49, 12, 'Horímetro inicial', formatNumber(record.horimetroInicial));
  drawTextCell(doc, left + 49, 52, 49, 12, 'Horímetro final', formatNumber(record.horimetroFinal));
  drawTextCell(doc, left + 98, 52, 50, 12, 'Total trabalhado', `${formatNumber(record.totalHorasTrabalhadas)} h`);
  drawTextCell(doc, left + 148, 52, 50, 12, 'Encarregado', record.encarregado);

  drawTableHeader(doc, ['Nº', 'Descrição do serviço / centro de custo', 'Cód. perda', 'Relógio (R) / Horímetro (H)', 'Inicial', 'Final', 'Total horas trabalhadas'], [8, 66, 15, 23, 25, 25, 36], left, 64, 7);
  drawActivityRows(doc, record, left, 71);

  drawTableHeader(doc, ['Nº', 'Descrição do serviço / centro de custo', 'Destino', 'Material transportado', 'Qtde viagens', 'Equipamento de carga'], [8, 61, 36, 37, 20, 36], left, 119, 7);
  drawTransportRows(doc, record, left, 126);

  doc.rect(left, 150, width / 2, 14);
  doc.rect(left + width / 2, 150, width / 2, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.text(record.apontador || '', left + width / 4, 158, { align: 'center' });
  doc.line(left + 10, 159.5, left + width / 2 - 10, 159.5);
  doc.text('Assinatura do apontador', left + width / 4, 162.5, { align: 'center' });
  doc.text(record.encarregado || '', left + width * 0.75, 158, { align: 'center' });
  doc.line(left + width / 2 + 10, 159.5, left + width - 10, 159.5);
  doc.text('Assinatura do encarregado', left + width * 0.75, 162.5, { align: 'center' });

  doc.setFillColor(226, 232, 240);
  doc.rect(left, 164, width, 7, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.text('CÓDIGO DE PERDAS (HORAS PARADAS)', left + width / 2, 168.5, { align: 'center' });
  const lossColumns = [CODIGOS_PERDA_PARTE_DIARIA.slice(0, 8), CODIGOS_PERDA_PARTE_DIARIA.slice(8)];
  lossColumns.forEach((column, columnIndex) => {
    column.forEach(([code, description], rowIndex) => {
      const x = left + columnIndex * width / 2 + 2;
      const y = 174 + rowIndex * 2.75;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.1);
      doc.text(`${code} -`, x, y);
      doc.setFont('helvetica', 'normal');
      doc.text(fitText(doc, description, width / 2 - 11), x + 7, y);
    });
  });
  doc.rect(left, 171, width, 25);
  doc.line(left + width / 2, 171, left + width / 2, 196);

  doc.setFillColor(226, 232, 240);
  doc.rect(left, 196, width, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.text('CHECKLIST DIÁRIO DO EQUIPAMENTO / VEÍCULO', left + width / 2, 200, { align: 'center' });
  drawTextCell(doc, left, 202, 40, 7, 'Nº frota', record.prefixo);
  drawTextCell(doc, left + 40, 202, 82, 7, 'Tipo de equipamento / veículo', record.tipoEquipamento);
  drawTextCell(doc, left + 122, 202, 35, 7, 'Data', formatDate(record.data));
  drawTextCell(doc, left + 157, 202, 41, 7, 'Operador / motorista', record.operadorNome);

  const checklistLookup = new Map(record.checklist.map(item => [item.codigo, item]));
  const checklistRows = 11;
  const checklistRowHeight = 5.1;
  for (let row = 0; row < checklistRows; row += 1) {
    [0, 1].forEach(column => {
      const itemIndex = row + column * checklistRows;
      const [code, description] = CHECKLIST_PADRAO_PARTE_DIARIA[itemIndex];
      const item = checklistLookup.get(code);
      const x = left + column * width / 2;
      const y = 209 + row * checklistRowHeight;
      doc.rect(x, y, width / 2, checklistRowHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.1);
      doc.text(code, x + 1.2, y + 3.4);
      doc.setFont('helvetica', 'normal');
      doc.text(fitText(doc, description, width / 2 - 31), x + 7, y + 3.4);
      drawChecklistResponse(doc, item?.resposta || 'N/A', x + width / 2 - 22, y + 0.9);
    });
  }

  const problemY = 209 + checklistRows * checklistRowHeight;
  doc.rect(left, problemY, width, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.text('OUTROS PROBLEMAS / OBSERVAÇÕES', left + 1.5, problemY + 3.3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  const problemText = [record.outrosProblemas, record.observacao].filter(Boolean).join(' | ') || 'Sem outros problemas informados.';
  doc.text(doc.splitTextToSize(problemText, width - 4).slice(0, 2), left + 1.5, problemY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.2);
  doc.setTextColor(100, 116, 139);
  doc.text(`Documento digital RENEA | Status: ${record.status} | Atualizado em ${new Date(record.atualizadoEm).toLocaleString('pt-BR')}`, left + width / 2, 293, { align: 'center' });
};

const drawAttachmentPage = (doc: jsPDF, record: ParteDiariaEquipamento) => {
  const hasOverflow = record.atividades.length > 8 || record.transportes.length > 4 || record.checklist.length > 22 || record.observacao.length > 220;
  if (!hasOverflow) return;

  doc.addPage('a4', 'portrait');
  const left = 12;
  const width = 186;
  let y = 14;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`ANEXO - PARTE DIÁRIA Nº ${record.numero}`, left, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`${record.prefixo} | ${record.tipoEquipamento} | ${formatDate(record.data)} | ${record.obraNome}`, left, y + 6);
  y += 14;

  const drawDetailSection = (title: string, rows: string[][]) => {
    if (!rows.length) return;
    doc.setFillColor(226, 232, 240);
    doc.rect(left, y, width, 7, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(title, left + 2, y + 4.8);
    y += 7;
    rows.forEach(row => {
      const line = row.join(' | ');
      const lines = doc.splitTextToSize(line, width - 4);
      const height = Math.max(7, lines.length * 4 + 2);
      if (y + height > 282) {
        doc.addPage('a4', 'portrait');
        y = 14;
      }
      doc.rect(left, y, width, height);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(lines, left + 2, y + 4.5);
      y += height;
    });
    y += 5;
  };

  drawDetailSection('ATIVIDADES ADICIONAIS', record.atividades.slice(8).map((item, index) => [
    `${index + 9}. ${item.descricao}`,
    item.centroCusto,
    `Cód. ${item.codigoPerda || '-'}`,
    `${item.inicial || '-'} a ${item.final || '-'}`,
    `${formatNumber(item.totalHoras)} h`,
  ]));
  drawDetailSection('TRANSPORTES ADICIONAIS', record.transportes.slice(4).map((item, index) => [
    `${index + 5}. ${item.descricao}`,
    item.destino,
    item.materialTransportado,
    `${item.quantidadeViagens} viagem(ns)`,
    item.equipamentoCarga,
  ]));
  drawDetailSection('CHECKLIST PERSONALIZADO', record.checklist.slice(22).map(item => [
    `${item.codigo}. ${item.descricao}`,
    item.resposta,
    item.observacao || '',
  ]));
  drawDetailSection('OBSERVAÇÕES COMPLETAS', [[record.observacao || 'Sem observações adicionais.']]);
};

export const createParteDiariaPdf = async (record: ParteDiariaEquipamento, logoDataUrl = '') => {
  const doc = new (await loadJsPdf())('p', 'mm', 'a4');
  drawMainPage(doc, record, logoDataUrl);
  drawAttachmentPage(doc, record);
  return doc;
};

export const downloadParteDiariaPdf = async (record: ParteDiariaEquipamento, logoUrl: string) => {
  const logoDataUrl = await loadImageAsDataUrl(logoUrl);
  const doc = await createParteDiariaPdf(record, logoDataUrl);
  const safePrefix = (record.prefixo || 'equipamento').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`parte_diaria_${record.numero || record.id}_${safePrefix}.pdf`);
};
