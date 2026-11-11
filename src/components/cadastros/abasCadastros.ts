import { Building2, ClipboardList, Construction, Droplets, Fuel, GitBranch, HardHat, Link2, MapPin, Route, ShieldCheck, Tent, Trash2, Truck, Users, type LucideIcon } from 'lucide-react';
import type { ItemDasAbas } from '../../shared/ui/AbasDaTela';
import { CADASTRO_GRUPOS, categoriasDoGrupo, type CadastroCategoriaId, type CadastroGrupoId } from '../../utils/cadastrosCategorias';

/** Partes do administrador que vieram da antiga aba Administração (10/11/2026). */
export type VistaSistema = 'acessos' | 'link-presenca';

/** Subtela aberta na aba Cadastros: um tipo de cadastro, a Lixeira ou uma parte do administrador. */
export type VistaCadastros = CadastroCategoriaId | 'lixeira' | VistaSistema;

export const ehVistaSistema = (vista: VistaCadastros): vista is VistaSistema => vista === 'acessos' || vista === 'link-presenca';

const ICONE_DO_GRUPO: Record<CadastroGrupoId, LucideIcon> = {
  pessoas: Users,
  frota: Truck,
  obra: MapPin,
};

const ICONE_DO_TIPO: Record<CadastroCategoriaId, LucideIcon> = {
  funcionarios: Users,
  empresas: Building2,
  terceiras: HardHat,
  fornecedores: Building2,
  'fornecedores-locacao': Construction,
  subfornecedores: GitBranch,
  equipamentos: Truck,
  veiculos: Truck,
  comboios: Fuel,
  canteiros: Tent,
  obras: MapPin,
  etapas: Route,
  frentes: HardHat,
  servicos: ClipboardList,
  combustiveis: Fuel,
  lubrificantes: Droplets,
};

/** Nome curto do grupo no celular, para a primeira linha caber sem apertar. */
const CURTO_DO_GRUPO: Partial<Record<CadastroGrupoId, string>> = { pessoas: 'Pessoas' };

const lixeira = (contar: (vista: VistaCadastros) => number) => ({
  id: 'lixeira' as const,
  rotulo: 'Lixeira',
  icone: Trash2,
  contador: contar('lixeira'),
  contadorRotulo: 'na Lixeira',
  tom: 'neutro' as const,
  testId: 'cadastro-categoria-lixeira',
});

/**
 * Subtelas de Cadastros como abas", no topo (AbasDaTela), na ordem e nos grupos
 * de cadastrosCategorias: Pessoas e empresas, Frota e insumos, Obra, a Lixeira
 * e, só para o administrador, Acessos e o Link de presença (junto da Lixeira). Cada aba mostra quantos cadastros ativos o
 * tipo tem (selo neutro); a Lixeira, quantos itens guarda.
 */
export const abasCadastros = (
  contar: (vista: VistaCadastros) => number,
  mostrarLixeira: boolean,
  mostrarSistema = false,
): ItemDasAbas<VistaCadastros>[] => [
  ...CADASTRO_GRUPOS.map(grupo => ({
    grupo: grupo.id,
    rotulo: grupo.label,
    curto: CURTO_DO_GRUPO[grupo.id],
    icone: ICONE_DO_GRUPO[grupo.id],
    abas: categoriasDoGrupo(grupo.id).map(categoria => ({
      id: categoria.id,
      rotulo: categoria.label,
      icone: ICONE_DO_TIPO[categoria.id],
      contador: contar(categoria.id),
      contadorRotulo: 'ativos',
      tom: 'neutro' as const,
      testId: `cadastro-categoria-${categoria.id}`,
    })),
  })),
  // Lixeira e as partes do administrador dividem uma aba só no topo: a aba
  // fica com no máximo quatro opções na primeira linha.
  ...(mostrarSistema ? [{
    grupo: 'sistema',
    rotulo: mostrarLixeira ? 'Lixeira e acessos' : 'Acessos e link',
    curto: mostrarLixeira ? 'Mais' : 'Acessos',
    icone: ShieldCheck,
    abas: [
      ...(mostrarLixeira ? [lixeira(contar)] : []),
      { id: 'acessos' as const, rotulo: 'Acessos', icone: ShieldCheck, testId: 'cadastro-categoria-acessos' },
      { id: 'link-presenca' as const, rotulo: 'Link de presença', icone: Link2, testId: 'cadastro-categoria-link-presenca' },
    ],
  }] : mostrarLixeira ? [lixeira(contar)] : []),
];
