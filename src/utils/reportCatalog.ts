export type ReportFormat = 'Excel' | 'PDF' | 'CSV' | 'Impressão';

export type ReportCatalogItem = {
  id: string;
  nome: string;
  modulo: string;
  descricao: string;
  formatos: ReportFormat[];
  camposChave: string[];
};

export const REPORT_CATALOG: ReportCatalogItem[] = [
  { id: 'combustivel', nome: 'Consumo de combustível', modulo: 'Combustível', descricao: 'Litros, leituras, médias, responsáveis e qualidade do lançamento.', formatos: ['Excel', 'PDF', 'CSV', 'Impressão'], camposChave: ['Data', 'Prefixo', 'Litros', 'Horímetro'] },
  { id: 'viagens', nome: 'Controle de viagens', modulo: 'Jazida', descricao: 'Liberação, recebimento, pareamento, duração, material e destino.', formatos: ['Excel', 'PDF', 'CSV', 'Impressão'], camposChave: ['Ticket', 'Placa', 'Material', 'Destino'] },
  { id: 'estacas', nome: 'Recebimento e cravação', modulo: 'Estacas', descricao: 'Lotes, notas fiscais, comprimentos, cravações, sobras e perdas.', formatos: ['Excel', 'PDF', 'CSV', 'Impressão'], camposChave: ['NF', 'Perfil', 'Recebido', 'Cravado'] },
  { id: 'materiais', nome: 'Materiais por ramo', modulo: 'Materiais', descricao: 'Quantidade, conversão por densidade, destino, fornecedor e custo.', formatos: ['Excel', 'PDF', 'CSV', 'Impressão'], camposChave: ['Material', 'Quantidade', 'Ramo', 'Total'] },
  { id: 'efetivo', nome: 'Efetivo por líder e área', modulo: 'Pessoas', descricao: 'Colaborador, função, encarregado, área, responsável e presença.', formatos: ['Excel', 'PDF', 'CSV', 'Impressão'], camposChave: ['Matrícula', 'Função', 'Líder', 'Área'] },
  { id: 'comercial', nome: 'Relatório comercial SPMAR', modulo: 'Comercial', descricao: 'Descarte, placa, autorização, vale, peso, preço e pagamento.', formatos: ['Excel', 'PDF', 'CSV', 'Impressão'], camposChave: ['Data', 'Placa', 'Autorização', 'Valor'] },
  { id: 'executivo', nome: 'Fechamento executivo', modulo: 'Gestão', descricao: 'Indicadores consolidados de operação, produção, custos e pendências.', formatos: ['Excel', 'PDF', 'CSV', 'Impressão'], camposChave: ['Período', 'Obra', 'Ramo', 'Indicador'] },
];

export const filterReportCatalog = (search: string, moduleName = '') => {
  const normalized = search.trim().toLocaleLowerCase('pt-BR');
  return REPORT_CATALOG.filter(item => !moduleName || item.modulo === moduleName)
    .filter(item => !normalized || `${item.nome} ${item.modulo} ${item.descricao}`.toLocaleLowerCase('pt-BR').includes(normalized));
};

export const buildCommercialReportRow = (input: {
  data: string;
  placa: string;
  autorizacao: string;
  vale: string;
  pesoLiquido: number;
  valorUnitario: number;
  volume?: string;
  pagamento?: string;
}) => ({
  ...input,
  valorTotal: Math.round(input.valorUnitario * 100) / 100,
  pagamento: input.pagamento || 'VENDA A PRAZO',
  volume: input.volume || 'U',
});
