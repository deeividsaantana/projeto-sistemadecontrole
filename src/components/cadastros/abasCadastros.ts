import { Building2, ClipboardList, Construction, Droplets, Fuel, GitBranch, HardHat, MapPin, Package, Route, Tent, Trash2, Truck, Users, type LucideIcon } from 'lucide-react';
import type { ItemDasAbas } from '../../shared/ui/AbasDaTela';
import { CADASTRO_GRUPOS, categoriasDoGrupo, type CadastroCategoriaId, type CadastroGrupoId } from '../../utils/cadastrosCategorias';

/** Subtela aberta na aba Cadastros: um tipo de cadastro ou a Lixeira. */
export type VistaCadastros = CadastroCategoriaId | 'lixeira';

const ICONE_DO_GRUPO: Record<CadastroGrupoId, LucideIcon> = {
  pessoas: Users,
  fornecedores: Building2,
  frota: Truck,
  obra: MapPin,
  insumos: Fuel,
};

const ICONE_DO_TIPO: Record<CadastroCategoriaId, LucideIcon> = {
  funcionarios: Users,
  empresas: Building2,
  terceiras: HardHat,
  fornecedores: Building2,
  'fornecedores-locacao': Construction,
  'fornecedores-materiais': Package,
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

/**
 * Subtelas de Cadastros como abas no topo (AbasDaTela), na ordem e nos grupos
 * de cadastrosCategorias: Pessoas e empresas, Fornecedores, Frota, Obra,
 * Insumos e, por fim, a Lixeira. Cada aba mostra quantos cadastros ativos o
 * tipo tem (selo neutro); a Lixeira, quantos itens guarda.
 */
export const abasCadastros = (
  contar: (vista: VistaCadastros) => number,
  mostrarLixeira: boolean,
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
  ...(mostrarLixeira ? [{
    id: 'lixeira' as const,
    rotulo: 'Lixeira',
    icone: Trash2,
    contador: contar('lixeira'),
    contadorRotulo: 'na Lixeira',
    tom: 'neutro' as const,
    testId: 'cadastro-categoria-lixeira',
  }] : []),
];
