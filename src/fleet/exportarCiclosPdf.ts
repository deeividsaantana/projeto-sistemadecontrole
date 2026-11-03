/**
 * Exportação de ciclos para PDF no estilo "controle operacional"
 * Similar ao layout do relatório de frotas/diesel
 */

import type { EquipmentCycle } from './cycleHistory';
import { extrairFasesCiclo, formatarDuracao, calcularMetricasCiclos } from './cycleHistory';

interface PdfOptions {
  titulo?: string;
  dataRelatorio?: string;
  rodape?: string;
}

/**
 * Gera CSV formatado para ciclos (podem ser importados em Excel/Google Sheets)
 * ou usados em iFrame de PDF via jsPDF
 */
export const gerarCsvCiclos = (ciclos: EquipmentCycle[]): string => {
  const linhas: string[] = [];

  // Cabeçalho
  linhas.push([
    'Equipamento',
    'Data',
    'Status',
    'Hora',
    'Duração',
    'Responsável',
    'Operador',
    'Observação',
  ].map(col => `"${col}"`).join(','));

  // Dados
  ciclos.forEach(ciclo => {
    const fases = extrairFasesCiclo(ciclo);
    fases.forEach(fase => {
      linhas.push([
        `"${ciclo.prefixo}"`,
        `"${ciclo.dataInicio}"`,
        `"${fase.status}"`,
        `"${fase.hora}"`,
        `"${fase.duracao ? formatarDuracao(fase.duracao) : '—'}"`,
        `"${fase.responsavel}"`,
        `"${fase.operador || '—'}"`,
        `"${fase.motivo || '—'}"`,
      ].join(','));
    });
  });

  return linhas.join('\n');
};

/**
 * Gera HTML para impressão/PDF estilo "controle operacional"
 * Usa estilos de página inteira, similar ao relatório de frotas
 */
export const gerarHtmlCiclos = (
  ciclos: EquipmentCycle[],
  options: PdfOptions = {}
): string => {
  const {
    titulo = 'Rastreamento de Ciclos Operacionais',
    dataRelatorio = new Date().toLocaleString('pt-BR'),
    rodape = 'Relatório Gerado Automaticamente',
  } = options;

  const metricas = calcularMetricasCiclos(ciclos);
  const totalOperacao = Math.floor(metricas.totalOperacao / 60);
  const minOperacao = metricas.totalOperacao % 60;
  const totalManutencao = Math.floor(metricas.totalManutencao / 60);
  const minManutencao = metricas.totalManutencao % 60;
  const totalParado = Math.floor(metricas.totalParado / 60);
  const minParado = metricas.totalParado % 60;

  const linhasHtml = ciclos.map(ciclo => {
    const fases = extrairFasesCiclo(ciclo);
    const statusColor: Record<string, string> = {
      'Em operação': '#10b981',
      'Em manutenção': '#f97316',
      'À disposição': '#3b82f6',
      'Aguardando manutenção': '#eab308',
    };

    const colColor = statusColor[ciclo.statusAtual] || '#6b7280';

    return `
      <tr>
        <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: 600; color: ${colColor};">
          ${ciclo.prefixo}
        </td>
        <td style="border: 1px solid #e5e7eb; padding: 8px;">${ciclo.dataInicio}</td>
        <td style="border: 1px solid #e5e7eb; padding: 8px;">
          <span style="display: inline-block; background-color: ${colColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
            ${ciclo.statusAtual}
          </span>
        </td>
        <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">
          ${ciclo.eventos.length} eventos
        </td>
        <td style="border: 1px solid #e5e7eb; padding: 8px;">
          ${ciclo.duracao ? `${Math.floor(ciclo.duracao / 60)}h ${ciclo.duracao % 60}m` : '—'}
        </td>
      </tr>
      ${fases.map((fase, idx) => `
        <tr style="background-color: #f9fafb;">
          <td colspan="2" style="border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 12px;">
            ${idx === 0 ? '↳' : ''} ${fase.status}
          </td>
          <td style="border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 12px;">${fase.hora}</td>
          <td style="border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 12px; text-align: right;">
            ${fase.duracao ? formatarDuracao(fase.duracao) : '—'}
          </td>
          <td style="border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 12px;">
            ${fase.responsavel}${fase.operador ? ` / ${fase.operador}` : ''}
            ${fase.motivo ? `<br/>📝 ${fase.motivo}` : ''}
          </td>
        </tr>
      `).join('')}
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1f2937;
      background: white;
      padding: 20px;
      line-height: 1.6;
    }
    @media print {
      body { padding: 0; }
      .page-break { page-break-after: always; }
      .no-print { display: none; }
    }

    .container { max-width: 1000px; margin: 0 auto; }

    .header {
      border-bottom: 3px solid #374151;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 4px;
    }

    .header p {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }

    .metric-card {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }

    .metric-card .label {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }

    .metric-card .value {
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
    }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #1f2937;
      background: #f3f4f6;
      padding: 12px;
      margin: 24px 0 12px 0;
      border-left: 4px solid #374151;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 13px;
    }

    thead {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }

    th {
      border: 1px solid #d1d5db;
      padding: 12px;
      text-align: left;
    }

    td {
      border: 1px solid #e5e7eb;
      padding: 10px;
    }

    tr:nth-child(odd) {
      background: white;
    }

    .footer {
      text-align: center;
      font-size: 11px;
      color: #6b7280;
      margin-top: 40px;
      padding-top: 12px;
      border-top: 1px solid #d1d5db;
    }

    .footer-date {
      color: #9ca3af;
      font-size: 10px;
    }

    @media (max-width: 768px) {
      .metrics { grid-template-columns: repeat(2, 1fr); }
      table { font-size: 11px; }
      th, td { padding: 8px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${titulo}</h1>
      <p>Relatório de rastreamento operacional de equipamentos</p>
      <p class="footer-date">${dataRelatorio}</p>
    </div>

    <div class="section-title">📊 Resumo Executivo</div>
    <div class="metrics">
      <div class="metric-card">
        <div class="label">Em Operação</div>
        <div class="value" style="color: #10b981;">${totalOperacao}h ${minOperacao}m</div>
      </div>
      <div class="metric-card">
        <div class="label">Manutenção</div>
        <div class="value" style="color: #f97316;">${totalManutencao}h ${minManutencao}m</div>
      </div>
      <div class="metric-card">
        <div class="label">À Disposição</div>
        <div class="value" style="color: #3b82f6;">${totalParado}h ${minParado}m</div>
      </div>
      <div class="metric-card">
        <div class="label">Disponibilidade</div>
        <div class="value" style="color: #6366f1;">${metricas.disponibilidade}%</div>
      </div>
    </div>

    <div class="section-title">📋 Detalhes dos Ciclos</div>
    <table>
      <thead>
        <tr>
          <th>Equipamento</th>
          <th>Data</th>
          <th>Status Atual</th>
          <th>Eventos</th>
          <th>Duração Total</th>
        </tr>
      </thead>
      <tbody>
        ${linhasHtml}
      </tbody>
    </table>

    <div class="footer">
      <p>${rodape}</p>
      <p class="footer-date">Gerado em ${dataRelatorio}</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Abre janela de impressão com o HTML dos ciclos
 */
export const imprimirCiclos = (ciclos: EquipmentCycle[], titulo?: string) => {
  const html = gerarHtmlCiclos(ciclos, { titulo });
  const janela = window.open('', '_blank');
  if (janela) {
    janela.document.write(html);
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 500);
  }
};

/**
 * Baixa ciclos como CSV
 */
export const baixarCsvCiclos = (ciclos: EquipmentCycle[], nomeArquivo = 'ciclos.csv') => {
  const csv = gerarCsvCiclos(ciclos);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', nomeArquivo);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
