/**
 * Quadro da frota: todos os equipamentos da obra num dia, separados pela
 * frente onde trabalharam. Sem React, para a conta ser testada sozinha.
 *
 * Nada aqui inventa estado: equipamento sem lançamento no Controle de Frotas
 * naquele dia aparece como "Sem lançamento", na coluna "Sem frente".
 */
import type { Abastecimento, ControleEquipamentoDiario, Equipamento, GrupoEquipe, StatusControleEquipamentoDiario } from '../../types';

export const SEM_FRENTE = 'Sem frente';

export type GrupoStatus = 'operando' | 'manutencao' | 'parado' | 'sem-lancamento';

export const ROTULO_GRUPO: Record<GrupoStatus, string> = {
  operando: 'Operando',
  manutencao: 'Manutenção',
  parado: 'Parado',
  'sem-lancamento': 'Sem lançamento',
};

const GRUPO_DO_STATUS: Record<StatusControleEquipamentoDiario, GrupoStatus> = {
  'Em operação': 'operando',
  'Em manutenção': 'manutencao',
  'Aguardando manutenção': 'manutencao',
  Disponível: 'parado',
  Reserva: 'parado',
  'Aguardando motorista': 'parado',
  'Aguardando equipamento': 'parado',
  'A confirmar': 'sem-lancamento',
  Desmobilizado: 'parado',
};

/** Desenho que o cartão mostra quando o equipamento não tem foto. */
export type Silhueta = 'escavadeira' | 'rolo' | 'trator' | 'retro' | 'caminhao' | 'pipa' | 'motoniveladora' | 'carregadeira' | 'agricola' | 'implemento' | 'veiculo' | 'outro';

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SILHUETAS: ReadonlyArray<[Silhueta, RegExp]> = [
  ['pipa', /pipa|tanque|comboio/],
  ['retro', /retro/],
  ['escavadeira', /escavadeira|escavadora|\bpc\d|ec\d/],
  ['rolo', /rolo|compactador/],
  ['motoniveladora', /motoniveladora|patrol|niveladora/],
  ['carregadeira', /carregadeira|pa carregadeira|\bpa\b/],
  ['trator', /trator de esteira|esteira|\bd\d|dozer/],
  ['agricola', /trator agricola|agricola|trator de pneu|trator/],
  ['caminhao', /caminhao|basculante|cacamba|truck|munck|prancha/],
  ['implemento', /grade|arado|implemento|reboque|carreta/],
  ['veiculo', /pickup|picape|caminhonete|carro|veiculo|onibus|van/],
];

export const silhuetaDo = (equipamento: Pick<Equipamento, 'tipo' | 'nome' | 'familia' | 'categoriaFrota'>): Silhueta => {
  // O tipo manda; família e nome só entram quando o tipo não diz nada.
  for (const campo of [equipamento.tipo, equipamento.familia, equipamento.nome]) {
    if (!campo) continue;
    const texto = semAcento(campo);
    const achada = SILHUETAS.find(([, regra]) => regra.test(texto));
    if (achada) return achada[0];
  }
  return equipamento.categoriaFrota === 'Veículo' ? 'veiculo' : 'outro';
};

export interface CartaoFrota {
  equipamentoId: string;
  prefixo: string;
  modelo: string;
  tipo: string;
  foto?: string;
  silhueta: Silhueta;
  frente: string;
  status: StatusControleEquipamentoDiario | 'Sem lançamento';
  grupo: GrupoStatus;
  operador?: string;
  /** Maior horímetro informado nos abastecimentos até o dia do quadro. */
  horimetro?: number;
  observacao?: string;
  motivoManutencao?: string;
  atualizadoEm?: string;
}

export interface ColunaFrota {
  frente: string;
  cartoes: CartaoFrota[];
  operando: number;
}

export interface IndicadoresFrota {
  total: number;
  operando: number;
  manutencao: number;
  parado: number;
  semLancamento: number;
  /** Lançados no dia que não estão em manutenção, sobre os lançados. Sem lançamento não entra na conta. */
  disponibilidade: number | null;
  comOperador: number;
  semOperador: number;
}

type RegistroDoDia = ControleEquipamentoDiario & { frenteServico?: string; equipeId?: string; excluido?: unknown };

export interface EntradaQuadro {
  dia: string;
  equipamentos: readonly Equipamento[];
  registros: readonly ControleEquipamentoDiario[];
  gruposEquipe: readonly GrupoEquipe[];
  abastecimentos: readonly Abastecimento[];
}

const comparar = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' }).compare;

export const montarQuadro = ({ dia, equipamentos, registros, gruposEquipe, abastecimentos }: EntradaQuadro): CartaoFrota[] => {
  // Último lançamento do dia de cada equipamento (o mais recente vale).
  const doDia = new Map<string, RegistroDoDia>();
  (registros as readonly RegistroDoDia[]).forEach(registro => {
    if (registro.data !== dia || registro.excluido) return;
    const atual = doDia.get(registro.equipamentoId);
    if (!atual || (registro.atualizadoEm || '') > (atual.atualizadoEm || '')) doDia.set(registro.equipamentoId, registro);
  });

  const horimetros = new Map<string, number>();
  abastecimentos.forEach(item => {
    if (!item.equipamentoId || item.data > dia || !Number.isFinite(item.horimetroInicial) || item.horimetroInicial <= 0) return;
    horimetros.set(item.equipamentoId, Math.max(horimetros.get(item.equipamentoId) ?? 0, item.horimetroInicial));
  });

  const frenteDaEquipe = new Map(gruposEquipe.map(grupo => [grupo.id, grupo.frenteServico]));

  return equipamentos
    // Desmobilizado sem lançamento no dia não está mais na obra.
    .filter(item => item.status !== 'Desmobilizado' || doDia.has(item.id))
    .map((item): CartaoFrota => {
      const registro = doDia.get(item.id);
      const frente = (registro?.frenteServico || (registro?.equipeId && frenteDaEquipe.get(registro.equipeId)) || '').trim() || SEM_FRENTE;
      const operador = (registro?.nomeMotorista || item.operadorResponsavelNome || '').trim() || undefined;
      return {
        equipamentoId: item.id,
        prefixo: item.prefixo,
        modelo: [item.marca, item.modelo].filter(Boolean).join(' ') || item.nome,
        tipo: item.tipo || 'Outro',
        foto: item.foto || undefined,
        silhueta: silhuetaDo(item),
        frente,
        status: registro ? registro.status : 'Sem lançamento',
        grupo: registro ? GRUPO_DO_STATUS[registro.status] ?? 'parado' : 'sem-lancamento',
        operador,
        horimetro: horimetros.get(item.id),
        observacao: registro?.observacao || undefined,
        motivoManutencao: registro?.motivoManutencao || undefined,
        atualizadoEm: registro?.atualizadoEm,
      };
    })
    .sort((a, b) => comparar(a.prefixo, b.prefixo));
};

export const calcularIndicadores = (cartoes: readonly CartaoFrota[]): IndicadoresFrota => {
  const conta = (grupo: GrupoStatus) => cartoes.filter(item => item.grupo === grupo).length;
  const semLancamento = conta('sem-lancamento');
  const manutencao = conta('manutencao');
  const lancados = cartoes.length - semLancamento;
  const comOperador = cartoes.filter(item => item.operador).length;
  return {
    total: cartoes.length,
    operando: conta('operando'),
    manutencao,
    parado: conta('parado'),
    semLancamento,
    disponibilidade: lancados > 0 ? Math.round(((lancados - manutencao) / lancados) * 100) : null,
    comOperador,
    semOperador: cartoes.length - comOperador,
  };
};

/** Colunas por frente, com mais equipamentos primeiro e "Sem frente" no fim. */
export const agruparPorFrente = (cartoes: readonly CartaoFrota[], frentesCadastradas: readonly string[] = []): ColunaFrota[] => {
  const colunas = new Map<string, CartaoFrota[]>();
  frentesCadastradas.forEach(frente => { if (frente.trim()) colunas.set(frente.trim(), []); });
  cartoes.forEach(cartao => {
    const lista = colunas.get(cartao.frente) || [];
    lista.push(cartao);
    colunas.set(cartao.frente, lista);
  });
  return Array.from(colunas, ([frente, lista]) => ({ frente, cartoes: lista, operando: lista.filter(item => item.grupo === 'operando').length }))
    .filter(coluna => coluna.frente !== SEM_FRENTE || coluna.cartoes.length > 0)
    .sort((a, b) => {
      if (a.frente === SEM_FRENTE) return 1;
      if (b.frente === SEM_FRENTE) return -1;
      return b.cartoes.length - a.cartoes.length || comparar(a.frente, b.frente);
    });
};

export interface FiltrosQuadro {
  frente: string;
  grupo: GrupoStatus | '';
  tipo: string;
  operador: '' | 'com' | 'sem';
  busca: string;
}

export const FILTROS_VAZIOS: FiltrosQuadro = { frente: '', grupo: '', tipo: '', operador: '', busca: '' };

export const filtrarCartoes = (cartoes: readonly CartaoFrota[], filtros: FiltrosQuadro): CartaoFrota[] => {
  const termos = semAcento(filtros.busca).split(/\s+/).filter(Boolean);
  return cartoes.filter(cartao => {
    if (filtros.frente && cartao.frente !== filtros.frente) return false;
    if (filtros.grupo && cartao.grupo !== filtros.grupo) return false;
    if (filtros.tipo && cartao.tipo !== filtros.tipo) return false;
    if (filtros.operador === 'com' && !cartao.operador) return false;
    if (filtros.operador === 'sem' && cartao.operador) return false;
    if (termos.length === 0) return true;
    const texto = semAcento([cartao.prefixo, cartao.modelo, cartao.tipo, cartao.operador, cartao.frente].filter(Boolean).join(' '));
    return termos.every(termo => texto.includes(termo));
  });
};
