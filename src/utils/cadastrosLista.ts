/**
 * A lista da aba Cadastros, sem React: que colunas cada tipo mostra, que
 * filtros oferece, o que conta como ativo e como buscar e ordenar.
 *
 * Todo tipo vira a mesma `LinhaCadastro`, então a tabela do computador, os
 * cartões do celular e o painel de detalhe desenham qualquer tipo igual.
 */
import type { Comboio, Empresa, Equipamento, EtapaServico, FrenteServico, Funcionario, ObraLocal, ProdutoLubrificacao, ServicoObra, TipoCombustivel } from '../types';
import {
  empresaTipoLabel,
  isActiveCollaborator,
  isEquipmentRentalSupplier,
  isMaterialSupplier,
  isSubSupplier,
  isSupplier,
  isThirdPartyContractor,
  isVehicle,
} from '../masterData/centralRegistry';
import type { CadastroCategoriaId } from './cadastrosCategorias';

export interface DadosCadastros {
  empresas: readonly Empresa[];
  obras: readonly ObraLocal[];
  equipamentos: readonly Equipamento[];
  funcionarios: readonly Funcionario[];
  comboios: readonly Comboio[];
  combustiveis: readonly TipoCombustivel[];
  lubrificantes: readonly ProdutoLubrificacao[];
  etapas: readonly EtapaServico[];
  /** Mesmo nome da coleção na nuvem, para a Lixeira valer em todo aparelho. */
  frentesServico: readonly FrenteServico[];
  servicosObra: readonly ServicoObra[];
}

export type RegistroCadastro = Empresa | ObraLocal | Equipamento | Funcionario | Comboio | TipoCombustivel | ProdutoLubrificacao | EtapaServico | FrenteServico | ServicoObra;

export type TomSituacao = 'ok' | 'alerta' | 'inativo';

export interface LinhaCadastro {
  id: string;
  titulo: string;
  /** Linha de apoio do cartão no celular (matrícula, função, placa). */
  detalhe: string;
  ativo: boolean;
  situacao: string;
  tom: TomSituacao;
  /** Valor exibido em cada coluna, pela `id` da coluna. */
  colunas: Record<string, string>;
  /** Valor de cada filtro, pela `id` do filtro. */
  filtros: Record<string, string>;
  busca: string;
  registro: RegistroCadastro;
}

export interface ColunaCadastro {
  id: string;
  label: string;
  /** Números e códigos em fonte tabular. */
  codigo?: boolean;
  /** Coluna principal: ganha mais largura que as outras. */
  larga?: boolean;
  /** Some em tela estreita (notebook), para as outras não cortarem. */
  secundaria?: boolean;
}

export interface FiltroCadastro {
  id: string;
  label: string;
}

/** Nome da tabela no retrato da nuvem, usado pela exclusão. */
export const TABELA_DA_CATEGORIA: Record<CadastroCategoriaId, keyof DadosCadastros> = {
  funcionarios: 'funcionarios',
  empresas: 'empresas',
  terceiras: 'empresas',
  fornecedores: 'empresas',
  'fornecedores-locacao': 'empresas',
  'fornecedores-materiais': 'empresas',
  subfornecedores: 'empresas',
  equipamentos: 'equipamentos',
  veiculos: 'equipamentos',
  comboios: 'comboios',
  obras: 'obras',
  etapas: 'etapas',
  frentes: 'frentesServico',
  servicos: 'servicosObra',
  combustiveis: 'combustiveis',
  lubrificantes: 'lubrificantes',
};

/** Tipos em que o cadastro pode ficar inativo sem ser excluído. */
export const temSituacao = (categoria: CadastroCategoriaId): boolean => (
  ['funcionarios', 'empresas', 'equipamentos', 'obras', 'frentesServico', 'servicosObra'].includes(TABELA_DA_CATEGORIA[categoria])
);

const COLUNAS_EMPRESA: ColunaCadastro[] = [
  { id: 'nome', label: 'Nome', larga: true },
  { id: 'cnpj', label: 'CNPJ', codigo: true },
  { id: 'classes', label: 'Classes' },
  { id: 'responsavel', label: 'Responsável' },
];

export const COLUNAS: Record<CadastroCategoriaId, ColunaCadastro[]> = {
  funcionarios: [
    { id: 'matricula', label: 'Matrícula', codigo: true },
    { id: 'nome', label: 'Nome', larga: true },
    { id: 'cargo', label: 'Função' },
    { id: 'empresa', label: 'Empresa' },
    { id: 'lider', label: 'Líder', secundaria: true },
  ],
  empresas: COLUNAS_EMPRESA,
  terceiras: COLUNAS_EMPRESA,
  fornecedores: COLUNAS_EMPRESA,
  'fornecedores-locacao': COLUNAS_EMPRESA,
  'fornecedores-materiais': COLUNAS_EMPRESA,
  subfornecedores: [...COLUNAS_EMPRESA.slice(0, 2), { id: 'principal', label: 'Atende por' }, COLUNAS_EMPRESA[3]],
  equipamentos: [
    { id: 'prefixo', label: 'Prefixo', codigo: true },
    { id: 'nome', label: 'Descrição', larga: true },
    { id: 'tipo', label: 'Tipo' },
    { id: 'empresa', label: 'Proprietária' },
    { id: 'local', label: 'Local', secundaria: true },
  ],
  veiculos: [
    { id: 'prefixo', label: 'Prefixo', codigo: true },
    { id: 'nome', label: 'Descrição', larga: true },
    { id: 'placa', label: 'Placa', codigo: true },
    { id: 'empresa', label: 'Proprietária' },
    { id: 'local', label: 'Local' },
  ],
  comboios: [
    { id: 'nome', label: 'Comboio' },
    { id: 'placa', label: 'Placa', codigo: true },
    { id: 'capacidade', label: 'Capacidade', codigo: true },
    { id: 'responsavel', label: 'Responsável' },
  ],
  obras: [
    { id: 'nome', label: 'Local' },
    { id: 'endereco', label: 'Endereço' },
    { id: 'responsavel', label: 'Responsável' },
  ],
  etapas: [
    { id: 'codigo', label: 'SGE', codigo: true },
    { id: 'nome', label: 'Ramo ou local', larga: true },
    { id: 'classe', label: 'Classe' },
    { id: 'ramo', label: 'Ramo' },
  ],
  frentes: [
    { id: 'nome', label: 'Frente', larga: true },
    { id: 'ramo', label: 'Ramo ou local' },
    { id: 'servico', label: 'Serviço' },
    { id: 'responsavel', label: 'Responsável', secundaria: true },
  ],
  servicos: [
    { id: 'codigo', label: 'Código', codigo: true },
    { id: 'descricao', label: 'Serviço', larga: true },
    { id: 'unidade', label: 'Unidade', codigo: true },
    { id: 'previsto', label: 'Previsto', codigo: true },
  ],
  combustiveis: [{ id: 'nome', label: 'Combustível' }],
  lubrificantes: [{ id: 'nome', label: 'Lubrificante' }],
};

export const FILTROS: Record<CadastroCategoriaId, FiltroCadastro[]> = {
  funcionarios: [
    { id: 'empresa', label: 'Empresa' },
    { id: 'cargo', label: 'Função' },
    { id: 'lider', label: 'Líder' },
    { id: 'situacao', label: 'Situação' },
  ],
  empresas: [{ id: 'classe', label: 'Classe' }],
  terceiras: [],
  fornecedores: [{ id: 'classe', label: 'Classe' }],
  'fornecedores-locacao': [],
  'fornecedores-materiais': [],
  subfornecedores: [{ id: 'principal', label: 'Atende por' }],
  equipamentos: [
    { id: 'tipo', label: 'Tipo' },
    { id: 'empresa', label: 'Proprietária' },
    { id: 'local', label: 'Local' },
    { id: 'situacao', label: 'Situação' },
  ],
  veiculos: [
    { id: 'empresa', label: 'Proprietária' },
    { id: 'local', label: 'Local' },
    { id: 'situacao', label: 'Situação' },
  ],
  comboios: [],
  obras: [{ id: 'situacao', label: 'Situação' }],
  etapas: [
    { id: 'classe', label: 'Classe' },
    { id: 'ramo', label: 'Ramo' },
  ],
  frentes: [
    { id: 'situacao', label: 'Situação' },
    { id: 'ramo', label: 'Ramo ou local' },
  ],
  servicos: [
    { id: 'situacao', label: 'Situação' },
    { id: 'unidade', label: 'Unidade' },
  ],
  combustiveis: [],
  lubrificantes: [],
};

const FILTRO_EMPRESA: Partial<Record<CadastroCategoriaId, (item: Empresa) => boolean>> = {
  fornecedores: isSupplier,
  'fornecedores-locacao': isEquipmentRentalSupplier,
  'fornecedores-materiais': isMaterialSupplier,
  subfornecedores: isSubSupplier,
  terceiras: isThirdPartyContractor,
};

export const normalizarBusca = (texto: string) => texto
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim();

const juntar = (...partes: Array<string | number | undefined | null>) => normalizarBusca(partes.filter(parte => parte !== undefined && parte !== null && parte !== '').join(' '));

const SITUACAO_FUNCIONARIO: Record<NonNullable<Funcionario['status']>, string> = {
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  'FÉRIAS': 'Férias',
  AFASTADO: 'Afastado',
  DESMOBILIZADO: 'Desmobilizado',
};

const tomFuncionario = (item: Funcionario): TomSituacao => {
  if (!isActiveCollaborator(item)) return 'inativo';
  return item.status === 'FÉRIAS' || item.status === 'AFASTADO' ? 'alerta' : 'ok';
};

const tomEquipamento = (status: Equipamento['status']): TomSituacao => {
  if (status === 'Desmobilizado') return 'inativo';
  return status === 'Ativo' || status === 'Mobilizado' ? 'ok' : 'alerta';
};

const linhaEmpresa = (item: Empresa, empresas: readonly Empresa[]): LinhaCadastro => {
  const ativo = item.status !== 'INATIVO';
  const classes = (item.tipos || []).map(empresaTipoLabel).join(', ');
  const principal = item.fornecedorPrincipalId ? empresas.find(empresa => empresa.id === item.fornecedorPrincipalId)?.nome || '' : '';
  return {
    id: item.id,
    titulo: item.nome,
    detalhe: [item.cnpj, classes].filter(Boolean).join(' · '),
    ativo,
    situacao: ativo ? 'Ativa' : 'Inativa',
    tom: ativo ? 'ok' : 'inativo',
    colunas: { nome: item.nome, cnpj: item.cnpj || '', classes: classes || 'Sem classe', responsavel: item.responsavel || '', principal },
    filtros: { classe: classes || 'Sem classe', principal: principal || 'Sem fornecedor principal' },
    busca: juntar(item.nome, item.cnpj, item.cnpj?.replace(/\D/g, ''), item.responsavel, item.telefone, classes, item.id),
    registro: item,
  };
};

/** Monta as linhas de um tipo com os nomes de empresa, local e líder já resolvidos. */
export const montarLinhas = (categoria: CadastroCategoriaId, dados: DadosCadastros): LinhaCadastro[] => {
  const nomeEmpresa = new Map(dados.empresas.map(item => [item.id, item.nome]));
  const nomeObra = new Map(dados.obras.map(item => [item.id, item.nome]));
  const tabela = TABELA_DA_CATEGORIA[categoria];

  if (tabela === 'empresas') {
    const filtro = FILTRO_EMPRESA[categoria];
    return (filtro ? dados.empresas.filter(filtro) : dados.empresas).map(item => linhaEmpresa(item, dados.empresas));
  }

  if (tabela === 'funcionarios') {
    return dados.funcionarios.map(item => {
      const situacao = SITUACAO_FUNCIONARIO[item.status || (item.ativo ? 'ATIVO' : 'INATIVO')];
      const empresa = nomeEmpresa.get(item.empresaId) || '';
      return {
        id: item.id,
        titulo: item.nome,
        detalhe: [item.matricula, item.cargo].filter(Boolean).join(' · '),
        ativo: isActiveCollaborator(item),
        situacao,
        tom: tomFuncionario(item),
        colunas: { matricula: item.matricula || '', nome: item.nome, cargo: item.cargo || '', empresa, lider: item.liderNome || '' },
        filtros: { empresa: empresa || 'Sem empresa', cargo: item.cargo || 'Sem função', lider: item.liderNome || 'Sem líder', situacao },
        busca: juntar(item.nome, item.matricula, item.cargo, item.liderNome, item.area, item.responsavelArea, item.telefone, empresa),
        registro: item,
      };
    });
  }

  if (tabela === 'equipamentos') {
    const lista = dados.equipamentos.filter(item => (categoria === 'veiculos' ? isVehicle(item) : !isVehicle(item)));
    return lista.map(item => {
      const empresa = nomeEmpresa.get(item.empresaId) || '';
      const local = nomeObra.get(item.localAtualId) || '';
      return {
        id: item.id,
        titulo: [item.prefixo, item.nome].filter(Boolean).join(' · '),
        detalhe: [item.tipo, item.placa || item.seriePlaca, local].filter(Boolean).join(' · '),
        ativo: item.status !== 'Desmobilizado',
        situacao: item.status,
        tom: tomEquipamento(item.status),
        colunas: { prefixo: item.prefixo, nome: item.nome, tipo: item.tipo || '', placa: item.placa || item.seriePlaca || '', empresa, local },
        filtros: { tipo: item.tipo || 'Sem tipo', empresa: empresa || 'Sem proprietária', local: local || 'Sem local', situacao: item.status },
        busca: juntar(item.prefixo, item.nome, item.tipo, item.marca, item.modelo, item.placa, item.seriePlaca, item.codigoSge, item.familia, item.operadorResponsavelNome, empresa, local),
        registro: item,
      };
    });
  }

  if (tabela === 'obras') {
    return dados.obras.map(item => ({
      id: item.id,
      titulo: item.nome,
      detalhe: [item.endereco, item.responsavel].filter(Boolean).join(' · '),
      ativo: item.status !== 'Concluída',
      situacao: item.status,
      tom: item.status === 'Ativa' ? 'ok' : item.status === 'Planejada' ? 'alerta' : 'inativo',
      colunas: { nome: item.nome, endereco: item.endereco || '', responsavel: item.responsavel || '' },
      filtros: { situacao: item.status },
      busca: juntar(item.nome, item.endereco, item.responsavel),
      registro: item,
    }));
  }

  if (tabela === 'comboios') {
    return dados.comboios.map(item => ({
      id: item.id,
      titulo: item.nome,
      detalhe: [item.placa, item.responsavel].filter(Boolean).join(' · '),
      ativo: true,
      situacao: 'Ativo',
      tom: 'ok',
      colunas: {
        nome: item.nome,
        placa: item.placa || '',
        capacidade: Number.isFinite(item.capacidadeLitros) ? `${item.capacidadeLitros.toLocaleString('pt-BR')} L` : '',
        responsavel: item.responsavel || '',
      },
      filtros: {},
      busca: juntar(item.nome, item.placa, item.responsavel),
      registro: item,
    }));
  }

  // Ramos e locais servem o site inteiro (materiais, apontamentos, horas):
  // cada um tem a sua classe e o código SGE de apropriação.
  if (tabela === 'etapas') {
    return dados.etapas.map(item => ({
      id: item.id,
      titulo: item.codigoSge ? `${item.codigoSge} · ${item.nome}` : item.nome,
      detalhe: [item.tipoLocal, item.ramo && item.ramo !== item.nome ? item.ramo : ''].filter(Boolean).join(' · '),
      ativo: true,
      situacao: 'Ativo',
      tom: 'ok',
      colunas: { codigo: item.codigoSge || '', nome: item.nome, classe: item.tipoLocal || '', ramo: item.ramo || '' },
      filtros: { classe: item.tipoLocal || 'Sem classe', ramo: item.ramo || 'Sem ramo' },
      busca: juntar(item.nome, item.codigoSge, item.tipoLocal, item.ramo, ...(item.apelidos || [])),
      registro: item,
    }));
  }

  // Frentes e serviços alimentam o Meu dia: a produção lançada lá escolhe
  // daqui. Encerrar (Concluída/Concluído ou inativa) tira da operação sem
  // apagar o histórico.
  if (tabela === 'frentesServico') {
    return dados.frentesServico.map(item => {
      const ativo = item.ativo !== false && item.situacao !== 'Concluída';
      const situacao = item.ativo === false ? 'Inativa' : item.situacao;
      return {
        id: item.id,
        titulo: item.nome,
        detalhe: [item.ramoLocal, item.servico].filter(Boolean).join(' · '),
        ativo,
        situacao,
        tom: !ativo ? 'inativo' : item.situacao === 'Em execução' ? 'ok' : 'alerta',
        colunas: { nome: item.nome, ramo: item.ramoLocal || '', servico: item.servico || '', responsavel: item.responsavel || '' },
        filtros: { situacao, ramo: item.ramoLocal || 'Sem ramo' },
        busca: juntar(item.nome, item.ramoLocal, item.servico, item.responsavel, item.observacao),
        registro: item,
      };
    });
  }

  if (tabela === 'servicosObra') {
    return dados.servicosObra.map(item => {
      const ativo = item.ativo !== false && item.situacao !== 'Concluído';
      const situacao = item.ativo === false ? 'Inativo' : item.situacao;
      const previsto = Number.isFinite(item.quantidadePrevista) ? `${(item.quantidadePrevista as number).toLocaleString('pt-BR')} ${item.unidade}` : '';
      return {
        id: item.id,
        titulo: item.codigo ? `${item.codigo} · ${item.descricao}` : item.descricao,
        detalhe: [item.unidade, previsto && `previsto ${previsto}`].filter(Boolean).join(' · '),
        ativo,
        situacao,
        tom: !ativo ? 'inativo' : item.situacao === 'Ativo' ? 'ok' : 'alerta',
        colunas: { codigo: item.codigo || '', descricao: item.descricao, unidade: item.unidade, previsto },
        filtros: { situacao, unidade: item.unidade || 'Sem unidade' },
        busca: juntar(item.codigo, item.descricao, item.unidade, item.observacao),
        registro: item,
      };
    });
  }

  const simples = dados[tabela] as readonly (TipoCombustivel | ProdutoLubrificacao)[];
  return simples.map(item => ({
    id: item.id,
    titulo: item.nome,
    detalhe: '',
    ativo: true,
    situacao: 'Ativo',
    tom: 'ok',
    colunas: { nome: item.nome },
    filtros: {},
    busca: juntar(item.nome),
    registro: item,
  }));
};

export type SituacaoLista = 'ativos' | 'inativos' | 'todos';

export interface ConsultaCadastros {
  busca: string;
  situacao: SituacaoLista;
  filtros: Record<string, string>;
}

/**
 * Busca sem acento e por todas as palavras: "cleiton motor" acha "Cleiton
 * Barbosa, Motorista". Filtro vazio não restringe.
 */
export const filtrarLinhas = (linhas: readonly LinhaCadastro[], consulta: ConsultaCadastros): LinhaCadastro[] => {
  const termos = normalizarBusca(consulta.busca).split(/\s+/).filter(Boolean);
  const filtros = Object.entries(consulta.filtros).filter(([, valor]) => valor);
  return linhas.filter(linha => {
    if (consulta.situacao === 'ativos' && !linha.ativo) return false;
    if (consulta.situacao === 'inativos' && linha.ativo) return false;
    if (filtros.some(([id, valor]) => linha.filtros[id] !== valor)) return false;
    return termos.every(termo => linha.busca.includes(termo));
  });
};

export const contarSituacoes = (linhas: readonly LinhaCadastro[]) => {
  const ativos = linhas.filter(linha => linha.ativo).length;
  return { ativos, inativos: linhas.length - ativos, todos: linhas.length };
};

const comparador = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/** Ordena pelo texto da coluna, com números em ordem natural ("CB9" antes de "CB10"). Vazio vai para o fim. */
export const ordenarLinhas = (linhas: readonly LinhaCadastro[], coluna: string, direcao: 'asc' | 'desc'): LinhaCadastro[] => {
  const sinal = direcao === 'asc' ? 1 : -1;
  return [...linhas].sort((a, b) => {
    const va = a.colunas[coluna] || '';
    const vb = b.colunas[coluna] || '';
    if (!va && vb) return 1;
    if (va && !vb) return -1;
    return sinal * comparador.compare(va, vb) || comparador.compare(a.titulo, b.titulo);
  });
};

/** Opções de um filtro, tiradas das próprias linhas, com quantas linhas cada uma tem. */
export const opcoesDoFiltro = (linhas: readonly LinhaCadastro[], filtro: string) => {
  const contagem = new Map<string, number>();
  linhas.forEach(linha => {
    const valor = linha.filtros[filtro];
    if (valor) contagem.set(valor, (contagem.get(valor) || 0) + 1);
  });
  return Array.from(contagem, ([valor, total]) => ({ valor, total }))
    .sort((a, b) => comparador.compare(a.valor, b.valor));
};
