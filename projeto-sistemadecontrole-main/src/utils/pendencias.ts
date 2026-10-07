import type {
  DocumentoArquivo,
  Equipamento,
  FichaVerificacaoServico,
  GrupoEquipe,
  Inspecao,
  ListaPresenca,
  Material,
  Medicao,
  MovimentoMaterial,
  NaoConformidade,
  ObraLocal,
  Ocorrencia,
  OrdemServico,
  PlanejamentoItem,
  PresencaApontamento,
  ControleEquipamentoDiario,
  RegistroProducao,
  TicketJazida,
  Treinamento,
} from '../types';
import { situacaoDocumento } from './documentos';
import { estaAtrasada as inspecaoAtrasada } from './inspecoes';
import { estaAtrasada as ncAtrasada } from './naoConformidades';
import { aderenciaDosPlanos } from './planejamento';
import { posicaoEstoque } from './estoque';
import { situacaoTreinamento } from './treinamentos';
import { origensSemTratativa } from './naoConformidades';

export type GravidadePendencia = 'alta' | 'media' | 'baixa';

export interface Pendencia {
  id: string;
  categoria: string;
  titulo: string;
  quantidade: number;
  /** Tela onde a pendência é resolvida — a lista nunca duplica o dado. */
  tab: string;
  gravidade: GravidadePendencia;
  detalhe?: string;
}

export interface ContextoPendencias {
  hoje: string;
  inicio: string;
  fim: string;
  equipamentos?: Equipamento[];
  controlesEquipamentos?: ControleEquipamentoDiario[];
  gruposEquipe?: GrupoEquipe[];
  presencasLink?: PresencaApontamento[];
  listasPresenca?: ListaPresenca[];
  obras?: ObraLocal[];
  ordensServico?: OrdemServico[];
  ticketsJazida?: TicketJazida[];
  fichasFvs?: FichaVerificacaoServico[];
  inspecoes?: Inspecao[];
  naoConformidades?: NaoConformidade[];
  documentos?: DocumentoArquivo[];
  treinamentos?: Treinamento[];
  planejamento?: PlanejamentoItem[];
  producao?: RegistroProducao[];
  medicoes?: Medicao[];
  materiais?: Material[];
  movimentosMaterial?: MovimentoMaterial[];
  ocorrencias?: Ocorrencia[];
}

const noPeriodo = (data: string | undefined, inicio: string, fim: string) =>
  Boolean(data) && data! >= inicio && data! <= fim;

/**
 * Toda pendência do sistema em um lugar só, derivada dos próprios registros.
 * Nada é salvo: a pendência some quando o registro de origem é resolvido, então
 * não existe fila para sincronizar nem contador para corrigir.
 */
export const listarPendencias = (contexto: ContextoPendencias): Pendencia[] => {
  const {
    hoje, inicio, fim,
    equipamentos = [], controlesEquipamentos = [], gruposEquipe = [], presencasLink = [],
    listasPresenca = [], obras = [], ordensServico = [], ticketsJazida = [],
    fichasFvs = [], inspecoes = [], naoConformidades = [], documentos = [], treinamentos = [],
    planejamento = [], producao = [], medicoes = [], materiais = [], movimentosMaterial = [],
    ocorrencias = [],
  } = contexto;

  const informados = new Set(controlesEquipamentos
    .filter(item => noPeriodo(item.data, inicio, fim))
    .map(item => item.equipamentoId || item.prefixo));

  const pendencias: Pendencia[] = [
    {
      id: 'frota-sem-informacao',
      categoria: 'Operação',
      titulo: 'Equipamentos sem informação no período',
      quantidade: equipamentos.filter(item => item.status !== 'Desmobilizado'
        && !informados.has(item.id) && !informados.has(item.prefixo)).length,
      tab: 'controle-equipamentos',
      gravidade: 'media',
    },
    {
      id: 'equipes-sem-apontamento',
      categoria: 'Pessoas',
      titulo: 'Equipes sem apontamento de presença',
      quantidade: gruposEquipe.filter(grupo => grupo.status !== 'inativo'
        && !presencasLink.some(item => item.grupoId === grupo.id && noPeriodo(item.data, inicio, fim))).length,
      tab: 'presenca',
      gravidade: 'media',
    },
    {
      id: 'obras-sem-lista',
      categoria: 'Pessoas',
      titulo: 'Obras ativas sem lista de presença',
      quantidade: obras.filter(obra => obra.status === 'Ativa'
        && !listasPresenca.some(lista => lista.obraId === obra.id && noPeriodo(lista.data, inicio, fim))).length,
      tab: 'presenca',
      gravidade: 'baixa',
    },
    {
      id: 'viagens-rascunho',
      categoria: 'Operação',
      titulo: 'Viagens ainda em rascunho',
      quantidade: ticketsJazida.filter(item => item.statusFluxo === 'Rascunho' && noPeriodo(item.data, inicio, fim)).length,
      tab: 'tickets-jazida',
      gravidade: 'baixa',
    },
    {
      id: 'os-abertas',
      categoria: 'Equipamentos',
      titulo: 'Ordens de serviço em aberto',
      quantidade: ordensServico.filter(item => !['Concluída', 'Cancelada'].includes(item.status)).length,
      tab: 'manutencao',
      gravidade: 'media',
    },
    {
      id: 'fvs-reprovadas',
      categoria: 'Qualidade',
      titulo: 'FVS reprovadas ou liberadas com pendência',
      quantidade: fichasFvs.filter(item => item.ativo !== false
        && ['Reprovada', 'Liberada com pendência'].includes(item.situacao)).length,
      tab: 'fvs',
      gravidade: 'alta',
    },
    {
      id: 'origens-sem-nc',
      categoria: 'Qualidade',
      titulo: 'Origens graves sem não conformidade aberta',
      quantidade: origensSemTratativa(fichasFvs, inspecoes, naoConformidades).length,
      tab: 'nao-conformidades',
      gravidade: 'alta',
    },
    {
      id: 'inspecoes-atrasadas',
      categoria: 'Segurança',
      titulo: 'Inspeções com prazo de correção vencido',
      quantidade: inspecoes.filter(item => item.ativo !== false && inspecaoAtrasada(item, hoje)).length,
      tab: 'inspecoes',
      gravidade: 'alta',
    },
    {
      id: 'nc-atrasadas',
      categoria: 'Qualidade',
      titulo: 'Não conformidades com prazo vencido',
      quantidade: naoConformidades.filter(item => item.ativo !== false && ncAtrasada(item, hoje)).length,
      tab: 'nao-conformidades',
      gravidade: 'alta',
    },
    {
      id: 'documentos-vencidos',
      categoria: 'Documentos',
      titulo: 'Documentos vencidos',
      quantidade: documentos.filter(item => item.ativo !== false && situacaoDocumento(item, hoje) === 'Vencido').length,
      tab: 'documentos',
      gravidade: 'alta',
    },
    {
      id: 'documentos-vencendo',
      categoria: 'Documentos',
      titulo: 'Documentos vencendo em até 30 dias',
      quantidade: documentos.filter(item => item.ativo !== false && situacaoDocumento(item, hoje) === 'Vence em breve').length,
      tab: 'documentos',
      gravidade: 'media',
    },
    {
      id: 'treinamentos-vencidos',
      categoria: 'Pessoas',
      titulo: 'Treinamentos vencidos',
      quantidade: treinamentos.filter(item => situacaoTreinamento(item, hoje) === 'Vencido').length,
      tab: 'dds-treinamentos',
      gravidade: 'alta',
    },
    {
      id: 'planos-atrasados',
      categoria: 'Planejamento',
      titulo: 'Planos com prazo vencido e meta não atingida',
      quantidade: aderenciaDosPlanos(planejamento, producao, hoje).filter(item => item.atrasado).length,
      tab: 'planejamento',
      gravidade: 'media',
    },
    {
      id: 'medicoes-em-elaboracao',
      categoria: 'Medições',
      titulo: 'Medições em elaboração',
      quantidade: medicoes.filter(item => item.ativo !== false && item.situacao === 'Em elaboração').length,
      tab: 'medicoes',
      gravidade: 'baixa',
    },
    {
      id: 'estoque-minimo',
      categoria: 'Materiais',
      titulo: 'Materiais abaixo do estoque mínimo',
      quantidade: posicaoEstoque(materiais.filter(item => item.ativo !== false), movimentosMaterial)
        .filter(item => item.abaixoDoMinimo).length,
      tab: 'materiais',
      gravidade: 'media',
    },
    {
      id: 'ocorrencias-sem-tratativa',
      categoria: 'Operação',
      titulo: 'Ocorrências em aberto ou sem tratativa',
      quantidade: ocorrencias.filter(item => item.ativo !== false
        && ['Registrada', 'Em análise', 'Sem tratativa'].includes(item.situacao)).length,
      tab: 'ocorrencias',
      gravidade: 'media',
    },
  ];

  const ordem: Record<GravidadePendencia, number> = { alta: 0, media: 1, baixa: 2 };
  return pendencias
    .filter(item => item.quantidade > 0)
    .sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade] || b.quantidade - a.quantidade);
};

export const resumoPendencias = (pendencias: Pendencia[]) => ({
  itens: pendencias.length,
  registros: pendencias.reduce((total, item) => total + item.quantidade, 0),
  altas: pendencias.filter(item => item.gravidade === 'alta').length,
  categorias: new Set(pendencias.map(item => item.categoria)).size,
});
