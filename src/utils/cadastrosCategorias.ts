/**
 * Tipos de cadastro mestre e o agrupamento que a aba Cadastros mostra.
 *
 * A ordem aqui é a ordem da tela: quem abre a aba procura primeiro gente e
 * máquina, depois obra e insumos. O texto do botão principal mora junto de
 * cada tipo para não virar "Novo registro" genérico, que obriga a pessoa a
 * conferir em qual sub-aba está antes de clicar.
 */
export type CadastroCategoriaId =
  | 'funcionarios'
  | 'empresas'
  | 'fornecedores'
  | 'terceiras'
  | 'equipamentos'
  | 'veiculos'
  | 'comboios'
  | 'obras'
  | 'etapas'
  | 'combustiveis'
  | 'lubrificantes';

export type CadastroGrupoId = 'pessoas' | 'frota' | 'obra' | 'insumos';

export interface CadastroCategoria {
  id: CadastroCategoriaId;
  grupo: CadastroGrupoId;
  label: string;
  acaoNovo: string;
}

export const CADASTRO_GRUPOS: readonly { id: CadastroGrupoId; label: string }[] = [
  { id: 'pessoas', label: 'Pessoas e empresas' },
  { id: 'frota', label: 'Frota' },
  { id: 'obra', label: 'Obra' },
  { id: 'insumos', label: 'Insumos' },
];

export const CADASTRO_CATEGORIAS: readonly CadastroCategoria[] = [
  { id: 'funcionarios', grupo: 'pessoas', label: 'Colaboradores', acaoNovo: 'Novo colaborador' },
  { id: 'empresas', grupo: 'pessoas', label: 'Empresas', acaoNovo: 'Nova empresa' },
  { id: 'fornecedores', grupo: 'pessoas', label: 'Fornecedores', acaoNovo: 'Novo fornecedor' },
  { id: 'terceiras', grupo: 'pessoas', label: 'Terceiras', acaoNovo: 'Nova terceira' },
  { id: 'equipamentos', grupo: 'frota', label: 'Equipamentos', acaoNovo: 'Novo equipamento' },
  { id: 'veiculos', grupo: 'frota', label: 'Veículos', acaoNovo: 'Novo veículo' },
  { id: 'comboios', grupo: 'frota', label: 'Comboios', acaoNovo: 'Novo comboio' },
  { id: 'obras', grupo: 'obra', label: 'Locais', acaoNovo: 'Novo local' },
  { id: 'etapas', grupo: 'obra', label: 'Ramos/Trechos', acaoNovo: 'Novo ramo/trecho' },
  { id: 'combustiveis', grupo: 'insumos', label: 'Combustíveis', acaoNovo: 'Novo combustível' },
  { id: 'lubrificantes', grupo: 'insumos', label: 'Lubrificantes', acaoNovo: 'Novo lubrificante' },
];

export const categoriasDoGrupo = (grupo: CadastroGrupoId) =>
  CADASTRO_CATEGORIAS.filter(categoria => categoria.grupo === grupo);

export const categoriaCadastro = (id: CadastroCategoriaId): CadastroCategoria =>
  CADASTRO_CATEGORIAS.find(categoria => categoria.id === id) ?? CADASTRO_CATEGORIAS[0];
