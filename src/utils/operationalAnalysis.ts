import type { MaterialCadastro, MaterialRegistro, ParteDiariaEquipamento } from '../types';

export interface OperationalIndicator {
  nome: string;
  valor: string;
  interpretacao: string;
}

export interface OperationalAction {
  acao: string;
  impacto: string;
  dificuldade: string;
  tempoEstimado: string;
  ganhoEsperado: string;
}

export interface OperationalAnalysis {
  resumoExecutivo: string[];
  principaisProblemas: string[];
  oportunidadesMelhoria: string[];
  automacoesRecomendadas: string[];
  indicadores: OperationalIndicator[];
  planoAcao: OperationalAction[];
  proximosPassos: string[];
  confianca: 'Alta' | 'Média' | 'Baixa';
}

const formatNumber = (value: number, digits = 2) =>
  Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: digits });

const normalize = (value: string = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const duplicateCount = <T,>(items: T[], getKey: (item: T) => string) => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  items.forEach(item => {
    const key = getKey(item);
    if (!key) return;
    if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  });
  return duplicates.size;
};

export const buildMaterialOperationalAnalysis = (
  registros: MaterialRegistro[],
  materiais: MaterialCadastro[] = [],
): OperationalAnalysis => {
  const totalRegistros = registros.length;
  const totalQuantidade = registros.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  const totalValor = registros.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const materiaisUnicos = new Set(registros.map(item => normalize(item.material)).filter(Boolean)).size;
  const semFornecedor = registros.filter(item => !item.fornecedor?.trim()).length;
  const semOrigemDestino = registros.filter(item => !item.origem?.trim() && !item.destino?.trim()).length;
  const semNota = registros.filter(item => !item.nota?.trim()).length;
  const semValor = registros.filter(item => !Number(item.total || 0) && !Number(item.valorUnitario || 0)).length;
  const divergentes = registros.filter(item => item.status === 'Divergência' || item.status === 'Pendente').length;
  const duplicidades = duplicateCount(registros, item =>
    [item.data, normalize(item.material), normalize(item.placa || item.prefixo || ''), normalize(item.nota || ''), Number(item.quantidade || 0).toFixed(3)].join('|'),
  );

  const problemas = [
    semFornecedor ? `${semFornecedor} lançamento(s) sem fornecedor informado.` : '',
    semOrigemDestino ? `${semOrigemDestino} lançamento(s) sem origem nem destino.` : '',
    semNota ? `${semNota} lançamento(s) sem nota/documento de referência.` : '',
    semValor ? `${semValor} lançamento(s) sem valor unitário ou total para análise financeira.` : '',
    divergentes ? `${divergentes} lançamento(s) com status pendente ou divergente.` : '',
    duplicidades ? `${duplicidades} possível(is) duplicidade(s) por data, material, veículo/documento e quantidade.` : '',
  ].filter(Boolean);

  const confianca: OperationalAnalysis['confianca'] = !totalRegistros
    ? 'Baixa'
    : problemas.length > 3
      ? 'Média'
      : 'Alta';

  return {
    resumoExecutivo: totalRegistros
      ? [
        `A importação trouxe ${totalRegistros} lançamento(s), ${materiaisUnicos} material(is) distinto(s) e ${formatNumber(totalQuantidade)} unidade(s) movimentada(s).`,
        totalValor > 0
          ? `O valor total informado soma ${totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
          : 'Não há valor total suficiente para estimar impacto financeiro com confiança.',
        `${materiais.length} material(is) podem alimentar ou atualizar o catálogo.`,
      ]
      : ['Nenhum lançamento de material foi reconhecido para análise.'],
    principaisProblemas: problemas.length
      ? problemas
      : ['Nenhum problema estrutural evidente foi encontrado nos lançamentos importados.'],
    oportunidadesMelhoria: [
      'Padronizar origem, destino, fornecedor, placa/prefixo e nota para rastrear cada viagem ou entrega.',
      'Usar catálogo único de materiais para evitar nomes diferentes para o mesmo insumo.',
      'Preencher valores unitários e totais quando o objetivo incluir custo por obra, fornecedor ou material.',
    ],
    automacoesRecomendadas: [
      'Aplicar importação por modelo padrão com validação de campos obrigatórios antes da confirmação.',
      'Criar alerta automático para possível duplicidade de nota, placa, material e quantidade.',
      'Gerar dashboard por material, fornecedor, origem/destino, placa e custo total.',
    ],
    indicadores: [
      { nome: 'Lançamentos', valor: String(totalRegistros), interpretacao: 'Volume importado para conferência.' },
      { nome: 'Materiais distintos', valor: String(materiaisUnicos), interpretacao: 'Variedade de insumos movimentados.' },
      { nome: 'Quantidade total', valor: formatNumber(totalQuantidade), interpretacao: 'Soma das quantidades informadas, sem converter unidades diferentes.' },
      { nome: 'Valor total', valor: totalValor ? totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem base', interpretacao: 'Só deve ser usado quando a planilha tiver valores confiáveis.' },
      { nome: 'Possíveis duplicidades', valor: String(duplicidades), interpretacao: 'Itens que merecem revisão antes de gravar.' },
    ],
    planoAcao: [
      { acao: 'Conferir registros sem fornecedor, nota, origem ou destino.', impacto: 'Alto', dificuldade: 'Baixa', tempoEstimado: 'Imediato', ganhoEsperado: 'Melhor rastreabilidade e menos retrabalho.' },
      { acao: 'Padronizar nomes de materiais pelo catálogo.', impacto: 'Médio', dificuldade: 'Baixa', tempoEstimado: '30 a 60 minutos', ganhoEsperado: 'Dashboards mais confiáveis por material.' },
      { acao: 'Implantar alerta de duplicidade na importação.', impacto: 'Médio', dificuldade: 'Média', tempoEstimado: '1 a 2 horas', ganhoEsperado: 'Redução de lançamentos repetidos.' },
    ],
    proximosPassos: [
      'Revisar a amostra importada no modal.',
      'Corrigir campos obrigatórios antes de confirmar quando houver muitos alertas.',
      'Confirmar a importação e acompanhar os indicadores no painel de materiais.',
    ],
    confianca,
  };
};

export const buildParteDiariaOperationalAnalysis = (
  registros: ParteDiariaEquipamento[],
): OperationalAnalysis => {
  const totalRegistros = registros.length;
  const horasTrabalhadas = registros.reduce((sum, item) => sum + Number(item.totalHorasTrabalhadas || 0), 0);
  const horasParadas = registros.reduce((sum, item) =>
    sum + item.atividades.filter(activity => activity.codigoPerda).reduce((subtotal, activity) => subtotal + Number(activity.totalHoras || 0), 0), 0);
  const semObra = registros.filter(item => !item.obraId && !item.obraNome?.trim()).length;
  const semEquipamento = registros.filter(item => !item.equipamentoId && !item.prefixo?.trim()).length;
  const semOperador = registros.filter(item => !item.operadorNome?.trim()).length;
  const inconsistentes = registros.filter(item => item.status === 'Inconsistente').length;
  const pendentes = registros.filter(item => item.status === 'Pendente').length;
  const deficientes = registros.filter(item => item.status === 'Com deficiência').length;
  const duplicidades = duplicateCount(registros, item =>
    item.numero ? `numero-${normalize(item.numero)}` : [item.data, normalize(item.prefixo), normalize(item.operadorNome)].join('|'),
  );

  const problemas = [
    semObra ? `${semObra} ficha(s) sem obra reconhecida.` : '',
    semEquipamento ? `${semEquipamento} ficha(s) sem equipamento/frota reconhecido.` : '',
    semOperador ? `${semOperador} ficha(s) sem operador/motorista.` : '',
    pendentes ? `${pendentes} ficha(s) pendente(s) de conferência.` : '',
    inconsistentes ? `${inconsistentes} ficha(s) inconsistente(s).` : '',
    deficientes ? `${deficientes} ficha(s) com deficiência de checklist.` : '',
    duplicidades ? `${duplicidades} possível(is) duplicidade(s) por número ou data/frota/operador.` : '',
  ].filter(Boolean);

  const aproveitamento = horasTrabalhadas + horasParadas > 0
    ? (horasTrabalhadas / (horasTrabalhadas + horasParadas)) * 100
    : 0;
  const confianca: OperationalAnalysis['confianca'] = !totalRegistros
    ? 'Baixa'
    : problemas.length > 3
      ? 'Média'
      : 'Alta';

  return {
    resumoExecutivo: totalRegistros
      ? [
        `A importação trouxe ${totalRegistros} parte(s) diária(s), com ${formatNumber(horasTrabalhadas, 1)} hora(s) trabalhada(s) e ${formatNumber(horasParadas, 1)} hora(s) parada(s).`,
        `O aproveitamento operacional calculado é ${formatNumber(aproveitamento, 1)}%, considerando apenas horas informadas.`,
        problemas.length ? 'Há fichas que precisam de conferência antes de uso gerencial.' : 'As fichas importadas não apresentaram problemas estruturais evidentes.',
      ]
      : ['Nenhuma parte diária foi reconhecida para análise.'],
    principaisProblemas: problemas.length
      ? problemas
      : ['Nenhum problema estrutural evidente foi encontrado nas fichas importadas.'],
    oportunidadesMelhoria: [
      'Padronizar número da ficha, frota, operador e obra para evitar duplicidade e retrabalho.',
      'Separar horas produtivas e códigos de perda para medir gargalos por motivo.',
      'Digitalizar checklist diário para reduzir ficha incompleta e facilitar auditoria.',
    ],
    automacoesRecomendadas: [
      'Importar partes por modelo padrão com validação de obra, frota e operador contra cadastros.',
      'Criar alerta de horímetro inconsistente, jornada acima do limite e duplicidade de ficha.',
      'Gerar dashboard de horas trabalhadas, horas paradas, aproveitamento e deficiências por frota.',
    ],
    indicadores: [
      { nome: 'Partes importadas', valor: String(totalRegistros), interpretacao: 'Volume de fichas entrando para conferência.' },
      { nome: 'Horas trabalhadas', valor: formatNumber(horasTrabalhadas, 1), interpretacao: 'Base para produtividade operacional.' },
      { nome: 'Horas paradas', valor: formatNumber(horasParadas, 1), interpretacao: 'Base para análise de perdas e gargalos.' },
      { nome: 'Aproveitamento', valor: `${formatNumber(aproveitamento, 1)}%`, interpretacao: 'Trabalho dividido por trabalho + parada, quando há horas suficientes.' },
      { nome: 'Possíveis duplicidades', valor: String(duplicidades), interpretacao: 'Fichas que podem representar lançamento repetido.' },
    ],
    planoAcao: [
      { acao: 'Conferir fichas sem obra, equipamento ou operador.', impacto: 'Alto', dificuldade: 'Baixa', tempoEstimado: 'Imediato', ganhoEsperado: 'Evita perda de rastreabilidade operacional.' },
      { acao: 'Revisar fichas pendentes, deficientes ou inconsistentes.', impacto: 'Alto', dificuldade: 'Média', tempoEstimado: 'No mesmo dia da importação', ganhoEsperado: 'Melhora qualidade dos KPIs de frota.' },
      { acao: 'Padronizar códigos de perda no apontamento.', impacto: 'Médio', dificuldade: 'Baixa', tempoEstimado: '1 hora', ganhoEsperado: 'Facilita atacar principais gargalos.' },
    ],
    proximosPassos: [
      'Revisar a amostra da importação.',
      'Corrigir cadastros não reconhecidos antes de confirmar quando houver muitos pendentes.',
      'Confirmar a importação e usar o painel de frota para acompanhar horas e deficiências.',
    ],
    confianca,
  };
};
