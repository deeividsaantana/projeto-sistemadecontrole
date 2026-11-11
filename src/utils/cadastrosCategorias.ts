/**
 * Tipos de cadastro mestre e o agrupamento que a aba Cadastros mostra.
 *
 * A ordem aqui é a ordem da tela: quem abre a aba procura primeiro gente e
 * empresas, depois máquina e insumos, depois obra. Três grupos só, para a aba
 * ter poucas opções no topo (10/11/2026). O texto do botão principal mora junto de
 * cada tipo para não virar "Novo registro" genérico, que obriga a pessoa a
 * conferir em qual sub-aba está antes de clicar.
 */
export type CadastroCategoriaId =
  | 'funcionarios'
  | 'empresas'
  | 'fornecedores'
  | 'fornecedores-locacao'
  | 'subfornecedores'
  | 'terceiras'
  | 'equipamentos'
  | 'veiculos'
  | 'comboios'
  | 'obras'
  | 'etapas'
  | 'frentes'
  | 'servicos'
  | 'combustiveis'
  | 'lubrificantes'
  | 'canteiros';

export type CadastroGrupoId = 'pessoas' | 'frota' | 'obra';

export interface CadastroCategoria {
  id: CadastroCategoriaId;
  grupo: CadastroGrupoId;
  label: string;
  acaoNovo: string;
}

export const CADASTRO_GRUPOS: readonly { id: CadastroGrupoId; label: string }[] = [
  { id: 'pessoas', label: 'Pessoas e empresas' },
  { id: 'frota', label: 'Frota e insumos' },
  { id: 'obra', label: 'Obra' },
];

export const CADASTRO_CATEGORIAS: readonly CadastroCategoria[] = [
  { id: 'funcionarios', grupo: 'pessoas', label: 'Colaboradores', acaoNovo: 'Novo colaborador' },
  { id: 'empresas', grupo: 'pessoas', label: 'Empresas', acaoNovo: 'Nova empresa' },
  { id: 'terceiras', grupo: 'pessoas', label: 'Terceiras', acaoNovo: 'Nova terceira' },
  { id: 'fornecedores', grupo: 'pessoas', label: 'Todos os fornecedores', acaoNovo: 'Novo fornecedor' },
  { id: 'fornecedores-locacao', grupo: 'pessoas', label: 'Locação de equipamentos', acaoNovo: 'Nova locadora' },
  { id: 'subfornecedores', grupo: 'pessoas', label: 'Subfornecedores', acaoNovo: 'Novo subfornecedor' },
  { id: 'equipamentos', grupo: 'frota', label: 'Equipamentos', acaoNovo: 'Novo equipamento' },
  { id: 'veiculos', grupo: 'frota', label: 'Veículos', acaoNovo: 'Novo veículo' },
  { id: 'comboios', grupo: 'frota', label: 'Comboios', acaoNovo: 'Novo comboio' },
  { id: 'canteiros', grupo: 'frota', label: 'Canteiros', acaoNovo: 'Novo canteiro' },
  { id: 'obras', grupo: 'obra', label: 'Locais', acaoNovo: 'Novo local' },
  { id: 'etapas', grupo: 'obra', label: 'Ramos e locais', acaoNovo: 'Novo ramo ou local' },
  { id: 'frentes', grupo: 'obra', label: 'Frentes de serviço', acaoNovo: 'Nova frente' },
  { id: 'servicos', grupo: 'obra', label: 'Serviços da obra', acaoNovo: 'Novo serviço' },
  { id: 'combustiveis', grupo: 'frota', label: 'Combustíveis', acaoNovo: 'Novo combustível' },
  { id: 'lubrificantes', grupo: 'frota', label: 'Lubrificantes', acaoNovo: 'Novo lubrificante' },
];

export const categoriasDoGrupo = (grupo: CadastroGrupoId) =>
  CADASTRO_CATEGORIAS.filter(categoria => categoria.grupo === grupo);

export const categoriaCadastro = (id: CadastroCategoriaId): CadastroCategoria =>
  CADASTRO_CATEGORIAS.find(categoria => categoria.id === id) ?? CADASTRO_CATEGORIAS[0];

type EmpresaCategoriaId = Extract<CadastroCategoriaId, 'empresas' | 'terceiras' | 'fornecedores' | 'fornecedores-locacao' | 'subfornecedores'>;
type EmpresaTipo = 'EMPRESA' | 'TERCEIRA' | 'FORNECEDOR' | 'LOCACAO_EQUIPAMENTOS' | 'SUBFORNECEDOR';

/** Classes com que um cadastro nasce quando é criado ou importado em cada tipo. */
export const TIPOS_POR_CATEGORIA_EMPRESA: Readonly<Record<EmpresaCategoriaId, readonly EmpresaTipo[]>> = {
  empresas: ['EMPRESA'],
  terceiras: ['TERCEIRA'],
  fornecedores: ['FORNECEDOR'],
  'fornecedores-locacao': ['FORNECEDOR', 'LOCACAO_EQUIPAMENTOS'],
  subfornecedores: ['FORNECEDOR', 'SUBFORNECEDOR'],
};

export const isCategoriaEmpresa = (id: CadastroCategoriaId): id is EmpresaCategoriaId => id in TIPOS_POR_CATEGORIA_EMPRESA;
