import type { DocumentoArquivo } from '../types';
import { DIAS_ALERTA_VENCIMENTO, exigeAtencao, situacaoVencimento, type SituacaoVencimento } from './vencimento';

export type SituacaoDocumento = SituacaoVencimento;

const ativos = (documentos: DocumentoArquivo[]) => documentos.filter(item => item.ativo !== false);

/** Situação do documento na data de referência, pela regra única de vencimento. */
export const situacaoDocumento = (
  documento: Pick<DocumentoArquivo, 'validade'>,
  hoje: string,
  diasAlerta: number = DIAS_ALERTA_VENCIMENTO,
): SituacaoDocumento => situacaoVencimento(documento.validade, hoje, diasAlerta);

/** Documentos que exigem ação: vencidos ou vencendo dentro do prazo de alerta. */
export const documentosParaAlertar = (
  documentos: DocumentoArquivo[],
  hoje: string,
  diasAlerta: number = DIAS_ALERTA_VENCIMENTO,
) => ativos(documentos)
  .map(documento => ({ documento, situacao: situacaoDocumento(documento, hoje, diasAlerta) }))
  .filter(item => exigeAtencao(item.situacao))
  .sort((a, b) => (a.documento.validade || '').localeCompare(b.documento.validade || ''));

/** Documentos de um registro específico, para a ficha do colaborador ou do equipamento. */
export const documentosDoVinculo = (
  documentos: DocumentoArquivo[],
  vinculo: DocumentoArquivo['vinculo'],
  vinculoId: string,
) => ativos(documentos)
  .filter(item => item.vinculo === vinculo && item.vinculoId === vinculoId)
  .sort((a, b) => (b.validade || b.emissao || '').localeCompare(a.validade || a.emissao || ''));

export const painelDocumentos = (documentos: DocumentoArquivo[], hoje: string) => {
  const lista = ativos(documentos);
  const situacoes = lista.map(item => situacaoDocumento(item, hoje));
  return {
    total: lista.length,
    vencidos: situacoes.filter(item => item === 'Vencido').length,
    vencendo: situacoes.filter(item => item === 'Vence em breve').length,
    semAnexo: lista.filter(item => !item.anexo).length,
  };
};

/** Vínculo declarado exige o registro; validade não pode preceder a emissão. */
export const validarDocumento = (
  candidato: Pick<DocumentoArquivo, 'titulo' | 'vinculo' | 'vinculoId' | 'emissao' | 'validade'>,
): string | null => {
  if (!candidato.titulo.trim()) return 'Informe o título do documento.';
  if (candidato.vinculo !== 'Geral' && !candidato.vinculoId) return `Selecione o registro de ${candidato.vinculo.toLowerCase()}.`;
  if (candidato.emissao && candidato.validade && candidato.validade < candidato.emissao) {
    return 'A validade não pode ser anterior à emissão.';
  }
  return null;
};
