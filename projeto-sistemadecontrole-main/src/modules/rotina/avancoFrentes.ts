/**
 * Avanço físico por frente para o Meu dia: o que cada frente fez no dia, o
 * acumulado, o previsto, o avanço em % e o saldo. Nada é guardado aqui: sai
 * da produção lançada (RegistroProducao) e do previsto de Planejamento.
 *
 * Avanço = acumulado ÷ previsto × 100 · Saldo = previsto − acumulado.
 * Sem previsto não há percentual: a tela não inventa meta.
 */
import type { FrenteServico, PlanejamentoItem, RegistroProducao, ServicoObra } from '../../types';
import { normalizeComparable } from '../../utils/canonicalIdentity';

export const SEM_FRENTE = 'Sem frente';

const arredondar = (valor: number) => Number(valor.toFixed(3));
const chave = (texto?: string) => normalizeComparable(texto || '') || normalizeComparable(SEM_FRENTE);

export interface LinhaAvanco {
  servicoId: string;
  servico: string;
  unidade: string;
  hoje: number;
  acumulado: number;
  /** Soma do previsto dos planos da frente que valem no dia. */
  previsto?: number;
  /** Início do período do previsto: o acumulado conta a partir daqui. */
  desde?: string;
  ate?: string;
  percentual?: number;
  saldo?: number;
}

export interface AvancoFrente {
  nome: string;
  frente?: FrenteServico;
  linhas: LinhaAvanco[];
  /** Houve produção lançada no dia. */
  trabalhouHoje: boolean;
}

const planoVale = (plano: PlanejamentoItem, dia: string) =>
  plano.ativo !== false && plano.situacao !== 'Cancelado' && plano.dataInicio <= dia && plano.dataFim >= dia;

/**
 * Uma entrada por frente: as frentes ativas que não terminaram e toda frente
 * que teve produção ou previsto no dia. Dentro de cada uma, uma linha por
 * serviço que tem produção ou previsto.
 */
export const avancoPorFrente = (
  dia: string,
  frentes: readonly FrenteServico[],
  servicos: readonly ServicoObra[],
  registros: readonly RegistroProducao[],
  planos: readonly PlanejamentoItem[],
): AvancoFrente[] => {
  const porChave = new Map<string, AvancoFrente>();
  const garantir = (nome: string | undefined, frente?: FrenteServico) => {
    const id = chave(nome);
    const atual = porChave.get(id) ?? { nome: nome?.trim() || SEM_FRENTE, linhas: [], trabalhouHoje: false };
    if (frente && !atual.frente) {
      atual.frente = frente;
      atual.nome = frente.nome;
    }
    porChave.set(id, atual);
    return atual;
  };

  frentes.filter(item => item.ativo !== false && item.situacao !== 'Concluída').forEach(item => garantir(item.nome, item));
  const producao = registros.filter(item => item.ativo !== false && item.data <= dia && (Number(item.quantidade) || 0) !== 0);
  const vigentes = planos.filter(plano => planoVale(plano, dia));
  const nomeDoServico = new Map(servicos.map(item => [item.id, item]));

  // Pares frente + serviço que aparecem no dia (produção do dia ou previsto valendo).
  const pares = new Map<string, { frente: string | undefined; servicoId: string; servico: string; unidade: string }>();
  const lembrar = (frente: string | undefined, servicoId: string, servico: string, unidade: string) => {
    const id = `${chave(frente)}|${servicoId}`;
    if (!pares.has(id)) pares.set(id, { frente, servicoId, servico, unidade });
  };
  producao.filter(item => item.data === dia).forEach(item => lembrar(item.frente, item.servicoId, item.servicoDescricao, item.unidade));
  vigentes.forEach(item => lembrar(item.frente, item.servicoId, item.servicoDescricao, item.unidade));

  for (const par of pares.values()) {
    const grupo = garantir(par.frente, frentes.find(item => item.ativo !== false && chave(item.nome) === chave(par.frente)));
    const daFrente = producao.filter(item => item.servicoId === par.servicoId && chave(item.frente) === chave(par.frente));
    const planosDaLinha = vigentes.filter(item => item.servicoId === par.servicoId && chave(item.frente) === chave(par.frente));
    const hoje = arredondar(daFrente.filter(item => item.data === dia).reduce((soma, item) => soma + Number(item.quantidade), 0));
    const cadastro = nomeDoServico.get(par.servicoId);
    const linha: LinhaAvanco = { servicoId: par.servicoId, servico: cadastro?.descricao || par.servico, unidade: cadastro?.unidade || par.unidade, hoje, acumulado: 0 };
    if (planosDaLinha.length) {
      const previsto = arredondar(planosDaLinha.reduce((soma, item) => soma + (Number(item.quantidadePlanejada) || 0), 0));
      const desde = planosDaLinha.map(item => item.dataInicio).sort()[0];
      const ate = planosDaLinha.map(item => item.dataFim).sort().at(-1);
      linha.acumulado = arredondar(daFrente.filter(item => item.data >= desde).reduce((soma, item) => soma + Number(item.quantidade), 0));
      linha.desde = desde;
      linha.ate = ate;
      if (previsto > 0) {
        linha.previsto = previsto;
        linha.percentual = Number(((linha.acumulado / previsto) * 100).toFixed(1));
        linha.saldo = arredondar(previsto - linha.acumulado);
      }
    } else {
      linha.acumulado = arredondar(daFrente.reduce((soma, item) => soma + Number(item.quantidade), 0));
    }
    if (hoje) grupo.trabalhouHoje = true;
    grupo.linhas.push(linha);
  }

  return [...porChave.values()]
    .map(grupo => ({ ...grupo, linhas: grupo.linhas.sort((a, b) => a.servico.localeCompare(b.servico, 'pt-BR')) }))
    .sort((a, b) => Number(b.trabalhouHoje) - Number(a.trabalhouHoje)
      || Number(a.nome === SEM_FRENTE) - Number(b.nome === SEM_FRENTE)
      || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
};

/** Resumo para os cartões do topo: frentes que trabalharam, paradas e sem previsto. */
export const resumoDasFrentes = (avanco: readonly AvancoFrente[]) => ({
  trabalharam: avanco.filter(item => item.trabalhouHoje).length,
  semProducao: avanco.filter(item => item.frente && !item.trabalhouHoje).length,
  semPrevisto: avanco.reduce((soma, item) => soma + item.linhas.filter(linha => linha.previsto === undefined).length, 0),
});
