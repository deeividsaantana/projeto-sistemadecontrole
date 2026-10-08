import type { CloudBaseline } from '../cloudMerge';

export type CloudData = Record<string, unknown>;

export interface CloudConnectionStatus { connected: boolean; updatedAt: string; schemaVersion: number; }
export interface CloudUploadResult { updatedAt: string; totalRecords: number; writtenDocuments: number; reusedDocuments: number; publishedBaseline?: CloudBaseline; }
export interface CloudDownloadResult { data: CloudData | null; source: string; updatedAt: string; totalRecords: number; }

export const INTERMEDIATE_TABLE_IDS = [
  'empresas', 'obras', 'equipamentos', 'funcionarios', 'motoristasOperacionais', 'comboios',
  'canteiros', 'combustiveis', 'lubrificantes', 'etapas', 'abastecimentos', 'lubrificacoes',
  'ticketsJazida', 'listasPresenca', 'ordensServico', 'gruposEquipe', 'presencasLink',
  'historicoPresencas', 'checklists', 'apontamentosOperacionais', 'registrosDds', 'treinamentos',
  'modelosChecklist', 'apontamentoRamos', 'apontamentoRamoRegistros', 'materiaisCadastro',
  'materiaisMovimentos', 'materiaisPrevistos', 'rotinasDiarias', 'pendenciasRotina', 'modelosRotina',
  'frentesServico', 'diariosObra', 'servicosObra', 'producaoRegistros', 'planejamentoItens',
  'modelosFvs', 'fichasFvs', 'inspecoes', 'naoConformidades', 'medicoes', 'documentos', 'ocorrencias',
  'lancamentosCusto', 'orcamentoItens', 'materiaisRegistros', 'controleEquipamentosDiario',
  'periodosArquivados', 'notifications', 'historyLogs', 'vinculosOperadorEquipamento', 'exclusoes',
] as const;
