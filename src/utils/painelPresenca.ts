import type { Empresa, Funcionario, GrupoEquipe, PresencaApontamento } from '../types';

/**
 * Números do painel de presença que não saem de uma contagem simples.
 * Todos leem o mesmo conjunto de apontamentos que a tela já filtrou — não
 * existe segundo caminho de dados, para o painel nunca discordar de si mesmo.
 */

const AUSENCIAS: readonly string[] = ['Ausente', 'Falta justificada'];

export interface EfetivoPorGrupo {
  chave: string;
  rotulo: string;
  confirmados: number;
  previstos: number;
  ausentes: number;
  /** Quanto do previsto apareceu, de 0 a 100. Sem previsto, não há percentual. */
  percentual: number | null;
}

const ordenarPorFalta = (a: EfetivoPorGrupo, b: EfetivoPorGrupo) => {
  const faltaA = a.previstos - a.confirmados;
  const faltaB = b.previstos - b.confirmados;
  return faltaB - faltaA || b.confirmados - a.confirmados || a.rotulo.localeCompare(b.rotulo, 'pt-BR');
};

const montar = (
  chave: string,
  rotulo: string,
  confirmados: number,
  ausentes: number,
  previstos: number,
): EfetivoPorGrupo => ({
  chave,
  rotulo,
  confirmados,
  ausentes,
  previstos,
  percentual: previstos > 0 ? Math.round((confirmados / previstos) * 100) : null,
});

/**
 * Efetivo por frente de serviço. A frente é maior que a equipe: várias equipes
 * podem estar no mesmo Ramo, e é pelo Ramo que se decide remanejar gente.
 */
export const efetivoPorFrente = (
  registros: PresencaApontamento[],
  equipes: GrupoEquipe[],
): EfetivoPorGrupo[] => {
  const previstoPorFrente = new Map<string, number>();
  (Array.isArray(equipes) ? equipes : []).forEach(equipe => {
    if (!equipe || equipe.status !== 'ativo') return;
    const frente = equipe.frenteServico?.trim() || 'Frente não informada';
    previstoPorFrente.set(frente, (previstoPorFrente.get(frente) || 0) + (equipe.funcionarioIds?.length || 0));
  });

  const confirmados = new Map<string, number>();
  const ausentes = new Map<string, number>();
  (Array.isArray(registros) ? registros : []).forEach(registro => {
    const frente = registro?.frenteServico?.trim() || 'Frente não informada';
    if (registro.status === 'Presente') confirmados.set(frente, (confirmados.get(frente) || 0) + 1);
    if (AUSENCIAS.includes(registro.status)) ausentes.set(frente, (ausentes.get(frente) || 0) + 1);
    if (!previstoPorFrente.has(frente)) previstoPorFrente.set(frente, 0);
  });

  return [...previstoPorFrente.entries()]
    .map(([frente, previstos]) => montar(frente, frente, confirmados.get(frente) || 0, ausentes.get(frente) || 0, previstos))
    .sort(ordenarPorFalta);
};

/** Efetivo por empresa: é assim que se cobra quem não entrega o contratado. */
export const efetivoPorEmpresa = (
  registros: PresencaApontamento[],
  funcionarios: Funcionario[],
  empresas: Empresa[],
): EfetivoPorGrupo[] => {
  const pessoaPorId = new Map((Array.isArray(funcionarios) ? funcionarios : []).map(item => [item.id, item]));
  const nomePorEmpresa = new Map((Array.isArray(empresas) ? empresas : []).map(item => [item.id, item.nome]));

  const confirmados = new Map<string, number>();
  const ausentes = new Map<string, number>();
  (Array.isArray(registros) ? registros : []).forEach(registro => {
    const empresaId = pessoaPorId.get(registro.funcionarioId)?.empresaId || 'sem-empresa';
    if (registro.status === 'Presente') confirmados.set(empresaId, (confirmados.get(empresaId) || 0) + 1);
    if (AUSENCIAS.includes(registro.status)) ausentes.set(empresaId, (ausentes.get(empresaId) || 0) + 1);
  });

  const chaves = new Set([...confirmados.keys(), ...ausentes.keys()]);
  return [...chaves]
    .map(empresaId => montar(
      empresaId,
      nomePorEmpresa.get(empresaId) || 'Empresa não informada',
      confirmados.get(empresaId) || 0,
      ausentes.get(empresaId) || 0,
      0,
    ))
    .sort((a, b) => b.confirmados - a.confirmados || a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
};

export interface FaltaRepetida {
  funcionarioId: string;
  nome: string;
  funcao: string;
  equipe: string;
  faltas: number;
  datas: string[];
}

/**
 * Quem falta sempre. O painel mostra o dia; o problema aparece no mês. As datas
 * vêm junto porque advertência sem data não se sustenta.
 */
export const faltasRepetidas = (
  registros: PresencaApontamento[],
  { minimo = 3, desde = '', ate = '' }: { minimo?: number; desde?: string; ate?: string } = {},
): FaltaRepetida[] => {
  const porPessoa = new Map<string, FaltaRepetida>();

  (Array.isArray(registros) ? registros : []).forEach(registro => {
    if (!registro || !AUSENCIAS.includes(registro.status)) return;
    if (desde && registro.data < desde) return;
    if (ate && registro.data > ate) return;

    const atual = porPessoa.get(registro.funcionarioId) || {
      funcionarioId: registro.funcionarioId,
      nome: registro.funcionarioNome,
      funcao: registro.funcao,
      equipe: registro.grupoNome,
      faltas: 0,
      datas: [],
    };
    // O mesmo dia não conta duas vezes, mesmo que o registro tenha sido
    // corrigido e regravado.
    if (!atual.datas.includes(registro.data)) {
      atual.datas.push(registro.data);
      atual.faltas += 1;
    }
    porPessoa.set(registro.funcionarioId, atual);
  });

  return [...porPessoa.values()]
    .filter(item => item.faltas >= minimo)
    .map(item => ({ ...item, datas: [...item.datas].sort().reverse() }))
    .sort((a, b) => b.faltas - a.faltas || a.nome.localeCompare(b.nome, 'pt-BR'));
};

/** Recuo de N dias a partir de uma data ISO, para as janelas do painel. */
export const diasAntes = (dataIso: string, dias: number): string => {
  const base = new Date(`${dataIso}T12:00:00`);
  if (Number.isNaN(base.getTime())) return dataIso;
  base.setDate(base.getDate() - dias);
  return base.toISOString().slice(0, 10);
};
