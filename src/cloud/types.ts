import type { CloudBaseline } from '../cloudMerge';

export type CloudData = Record<string, unknown>;

export interface CloudConnectionStatus { connected: boolean; updatedAt: string; schemaVersion: number; }
export interface CloudUploadResult {
  updatedAt: string;
  totalRecords: number;
  writtenDocuments: number;
  reusedDocuments: number;
  publishedBaseline?: CloudBaseline;
  /** Tabelas em que o envio ia apagar muita coisa sem explicação e a nuvem foi preservada. */
  tabelasProtegidas?: Array<{ tabela: string; devolvidos: number }>;
  /** Outro aparelho publicou desde a versão conhecida: falta baixar a nuvem. */
  nuvemTinhaNovidades?: boolean;
}
export interface CloudDownloadResult { data: CloudData | null; source: string; updatedAt: string; totalRecords: number; }

export const INTERMEDIATE_TABLE_IDS = [
  'empresas', 'obras', 'equipamentos', 'funcionarios', 'motoristasOperacionais', 'comboios',
  'canteiros', 'combustiveis', 'lubrificantes', 'etapas', 'abastecimentos', 'lubrificacoes',
  'listasPresenca', 'ordensServico', 'gruposEquipe', 'presencasLink',
  'historicoPresencas', 'checklists', 'apontamentosOperacionais', 'registrosDds', 'treinamentos',
  'modelosChecklist', 'apontamentoRamos', 'apontamentoRamoRegistros',
  'rotinasDiarias', 'pendenciasRotina', 'modelosRotina',
  'frentesServico', 'diariosObra', 'solicitacoes', 'pessoasSuprimentos', 'servicosObra', 'producaoRegistros', 'planejamentoItens',
  'modelosFvs', 'fichasFvs', 'inspecoes', 'naoConformidades', 'medicoes', 'documentos', 'ocorrencias',
  'lancamentosCusto', 'orcamentoItens', 'controleEquipamentosDiario',
  'periodosArquivados', 'notifications', 'historyLogs', 'vinculosOperadorEquipamento', 'exclusoes',
] as const;
