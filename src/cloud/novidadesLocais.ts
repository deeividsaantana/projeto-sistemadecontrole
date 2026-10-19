import { aplicarExclusoes } from './exclusoes';
import { CHAVE_DE_CONTEUDO } from './protecaoEncolhimento';
import type { CloudBaseline } from '../cloudMerge';

type Retrato = Record<string, unknown>;

export interface TabelaMantida {
  tabela: string;
  mantidos: number;
}

const idDe = (item: unknown): string => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
  const id = (item as { id?: unknown }).id;
  return typeof id === 'string' ? id : '';
};

/**
 * Baixar a nuvem trocava cada tabela local pela da nuvem. O que este aparelho
 * criou e ainda não tinha subido (envio que falhou, rede caiu) sumia sem aviso
 * (auditoria de 16/10, C5).
 *
 * Aqui o que é novo deste aparelho fica: registro que não estava na base da
 * última sincronização e que a nuvem não tem. O que estava na base e sumiu da
 * nuvem foi apagado por outro aparelho e continua saindo.
 *
 * Sem base (navegador novo ou cópia antiga sem base) não há como separar
 * "criei aqui" de "cópia velha", então nada é mantido: foi esse o caso do
 * notebook que duplicou os abastecimentos.
 */
export const manterNovidadesLocais = <T extends Retrato>(
  nuvem: T,
  local: Retrato,
  baseAnterior: CloudBaseline | undefined,
): { retrato: T; mantidas: TabelaMantida[] } => {
  if (!baseAnterior) return { retrato: nuvem, mantidas: [] };
  let retrato: Retrato | null = null;
  const mantidas: TabelaMantida[] = [];

  for (const [tabela, valorLocal] of Object.entries(local)) {
    const valorNuvem = nuvem[tabela];
    const base = baseAnterior[tabela];
    if (!Array.isArray(valorLocal) || !Array.isArray(valorNuvem) || !base) continue;
    const naBase = new Set(base);
    const naNuvem = new Set(valorNuvem.map(idDe).filter(Boolean));
    const chaveDe = CHAVE_DE_CONTEUDO[tabela];
    const chavesNuvem = chaveDe ? new Set(valorNuvem.map(chaveDe).filter(Boolean)) : null;
    const novos = valorLocal.filter(item => {
      const id = idDe(item);
      if (!id || naBase.has(id) || naNuvem.has(id)) return false;
      // Mesmo lançamento com outro código interno (importação repetida da planilha).
      const chave = chaveDe ? chaveDe(item) : '';
      return !(chave && chavesNuvem?.has(chave));
    });
    if (novos.length === 0) continue;
    retrato ??= { ...nuvem };
    retrato[tabela] = [...novos, ...valorNuvem];
    mantidas.push({ tabela, mantidos: novos.length });
  }

  if (!retrato) return { retrato: nuvem, mantidas: [] };
  return { retrato: aplicarExclusoes(retrato) as T, mantidas };
};
