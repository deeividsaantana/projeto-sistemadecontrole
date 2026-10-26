import { BrickWall, Boxes, ChartPie, ClipboardPen, Cylinder, FileBarChart, FileSpreadsheet, Hammer, LayoutDashboard, ListOrdered, MapPinned, Mountain, Package, Route, Target, Ticket, TreePine, Truck, UserRoundCheck, type LucideIcon } from 'lucide-react';
import type { AbaDaTela, ItemDasAbas } from '../../shared/ui/AbasDaTela';
import type { ClasseMaterial } from '../../modules/materials/classesMateriais';

/**
 * Subtelas de Materiais (auditoria de front de 21/10/2026, A3): abas no topo,
 * agrupadas, no lugar do menu lateral interno. A ordem é a mesma dos atalhos
 * de teclado 1 a 9 e 0.
 */
export type SecaoMateriais = 'lancar' | 'resumo' | 'graficos' | 'relatorios' | 'previsto' | 'utilizacao' | 'apontadores' | 'botafora' | 'viagens' | 'estoque' | 'movimentos' | 'cadastro' | 'locais' | 'importacoes';

interface Secao {
  id: SecaoMateriais;
  nome: string;
  /** Nome curto para o celular. */
  curto?: string;
  Icone: LucideIcon;
}

const GRUPOS: ReadonlyArray<{ id: string; nome: string; curto?: string; Icone: LucideIcon; secoes: readonly Secao[] }> = [
  { id: 'lancar', nome: 'Lançar', Icone: ClipboardPen, secoes: [{ id: 'lancar', nome: 'Lançar', Icone: ClipboardPen }] },
  {
    id: 'painel',
    nome: 'Painel',
    Icone: LayoutDashboard,
    secoes: [
      { id: 'resumo', nome: 'Visão geral', Icone: LayoutDashboard },
      { id: 'graficos', nome: 'Gráficos', Icone: ChartPie },
      { id: 'relatorios', nome: 'Relatórios', Icone: FileBarChart },
    ],
  },
  {
    id: 'obra',
    nome: 'Na obra',
    Icone: Route,
    secoes: [
      { id: 'previsto', nome: 'Previsto do mês', curto: 'Previsto', Icone: Target },
      { id: 'utilizacao', nome: 'Uso por ramo', Icone: Route },
      { id: 'apontadores', nome: 'Apontadores', Icone: UserRoundCheck },
      { id: 'botafora', nome: 'Bota-fora', Icone: Truck },
      { id: 'viagens', nome: 'Viagens da jazida', curto: 'Jazida', Icone: Ticket },
    ],
  },
  {
    id: 'controle',
    nome: 'Controle',
    Icone: Boxes,
    secoes: [
      { id: 'estoque', nome: 'Estoque', Icone: Boxes },
      { id: 'movimentos', nome: 'Movimentos', Icone: ListOrdered },
    ],
  },
  {
    id: 'cadastrar',
    nome: 'Cadastrar',
    Icone: Package,
    secoes: [
      { id: 'cadastro', nome: 'Materiais', Icone: Package },
      { id: 'locais', nome: 'Ramos e locais', curto: 'Locais', Icone: MapPinned },
      { id: 'importacoes', nome: 'Importar planilha', curto: 'Importar', Icone: FileSpreadsheet },
    ],
  },
];

const TODAS = GRUPOS.flatMap(grupo => grupo.secoes);

/** Ordem das subtelas: a dos grupos, da esquerda para a direita. */
export const ORDEM_SECOES: readonly SecaoMateriais[] = TODAS.map(secao => secao.id);

export const nomeDaSecao = (id: SecaoMateriais) => TODAS.find(secao => secao.id === id)?.nome ?? '';

/** Selo laranja de uma subtela: quantos itens pedem atenção ali. */
export type ContadoresMateriais = Partial<Record<SecaoMateriais, { valor: number; rotulo: string }>>;

/**
 * Abas da tela, só com as subtelas que a pessoa pode abrir. Grupo com uma
 * subtela só vira aba solta (Lançar); grupo vazio some.
 */
export const abasDeMateriais = (secoes: readonly SecaoMateriais[], contadores: ContadoresMateriais = {}): ItemDasAbas<SecaoMateriais>[] => GRUPOS
  .map(grupo => ({ ...grupo, secoes: grupo.secoes.filter(secao => secoes.includes(secao.id)) }))
  .filter(grupo => grupo.secoes.length > 0)
  .map((grupo): ItemDasAbas<SecaoMateriais> => {
    const abas = grupo.secoes.map((secao): AbaDaTela<SecaoMateriais> => ({
      id: secao.id,
      rotulo: secao.nome,
      curto: secao.curto,
      icone: secao.Icone,
      contador: contadores[secao.id]?.valor,
      contadorRotulo: contadores[secao.id]?.rotulo,
    }));
    return abas.length === 1 && grupo.secoes[0].id === grupo.id ? abas[0] : { grupo: grupo.id, rotulo: grupo.nome, curto: grupo.curto, icone: grupo.Icone, abas };
  });

/** Ícone de cada classe de material, nas abas de Uso por ramo. */
export const ICONE_DA_CLASSE: Record<ClasseMaterial, LucideIcon> = {
  'Tubo de concreto': Cylinder,
  'Tubo PEAD e PVC': Cylinder,
  Madeira: TreePine,
  Aço: Hammer,
  Agregados: Mountain,
  'Concreto e argamassa': BrickWall,
  Outros: Package,
};
