import type { FichaVerificacaoServico, Inspecao, NaoConformidade, SituacaoNaoConformidade } from '../types';

export const NC_EM_ABERTO: SituacaoNaoConformidade[] = ['Aberta', 'Em tratamento', 'Verificação'];

const ativas = (registros: NaoConformidade[]) => registros.filter(item => item.ativo !== false);

export const estaAtrasada = (registro: NaoConformidade, hoje: string) =>
  NC_EM_ABERTO.includes(registro.situacao) && Boolean(registro.prazo) && registro.prazo! < hoje;

/**
 * Origens que ainda não viraram não conformidade: FVS reprovada e inspeção de
 * gravidade alta em aberto. A lista é derivada, então some sozinha quando a NC
 * é criada — não existe fila para sincronizar.
 */
export const origensSemTratativa = (
  fichas: FichaVerificacaoServico[],
  inspecoes: Inspecao[],
  registros: NaoConformidade[],
) => {
  const jaTratadas = new Set(ativas(registros).map(item => item.origemId).filter(Boolean));
  return [
    ...fichas
      .filter(ficha => ficha.ativo !== false && ficha.situacao === 'Reprovada' && !jaTratadas.has(ficha.id))
      .map(ficha => ({ id: ficha.id, origem: 'FVS' as const, numero: ficha.numero, descricao: `FVS reprovada em ${ficha.local}`, data: ficha.data, frente: ficha.frente, obraId: ficha.obraId })),
    ...inspecoes
      .filter(item => item.ativo !== false && item.gravidade === 'Alta'
        && ['Aberta', 'Em correção'].includes(item.situacao) && !jaTratadas.has(item.id))
      .map(item => ({ id: item.id, origem: 'Inspeção' as const, numero: item.numero, descricao: item.descricao, data: item.data, frente: item.frente, obraId: item.obraId })),
  ].sort((a, b) => b.data.localeCompare(a.data));
};

export const painelNaoConformidades = (registros: NaoConformidade[], hoje: string) => {
  const lista = ativas(registros);
  const abertas = lista.filter(item => NC_EM_ABERTO.includes(item.situacao));
  return {
    total: lista.length,
    abertas: abertas.length,
    atrasadas: abertas.filter(item => estaAtrasada(item, hoje)).length,
    encerradas: lista.filter(item => item.situacao === 'Encerrada').length,
    ineficazes: lista.filter(item => item.situacao === 'Encerrada' && item.eficaz === false).length,
  };
};

/**
 * Encerrar exige causa raiz, ação e um veredito de eficácia: sem isso a NC
 * fecharia sem dizer por que aconteceu nem se a correção resolveu.
 */
export const validarNaoConformidade = (
  candidata: Pick<NaoConformidade, 'data' | 'descricao' | 'situacao' | 'causaRaiz' | 'acaoCorretiva' | 'prazo' | 'eficaz'>,
): string | null => {
  if (!candidata.data) return 'Informe a data.';
  if (!candidata.descricao.trim()) return 'Descreva a não conformidade.';
  if (candidata.prazo && candidata.prazo < candidata.data) return 'O prazo não pode ser anterior ao registro.';
  if (candidata.situacao === 'Encerrada') {
    if (!candidata.causaRaiz?.trim()) return 'Informe a causa raiz antes de encerrar.';
    if (!candidata.acaoCorretiva?.trim()) return 'Informe a ação corretiva antes de encerrar.';
    if (candidata.eficaz === undefined) return 'Informe se a ação foi eficaz antes de encerrar.';
  }
  return null;
};

export const proximoNumeroNc = (registros: NaoConformidade[], ano = new Date().getFullYear()) => {
  const prefixo = `NC-${ano}-`;
  const ultimo = registros
    .filter(item => item.numero?.startsWith(prefixo))
    .map(item => Number(item.numero.slice(prefixo.length)) || 0)
    .reduce((maior, valor) => Math.max(maior, valor), 0);
  return `${prefixo}${String(ultimo + 1).padStart(4, '0')}`;
};
