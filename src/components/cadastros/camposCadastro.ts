/**
 * Formulário de cada tipo de cadastro, descrito como lista de campos.
 *
 * Um só componente desenha qualquer tipo a partir daqui. Os obrigatórios vêm
 * primeiro; o resto fica em "Mais informações", fechado, para a pessoa com
 * pressa ver só o que precisa preencher.
 *
 * Salvar parte sempre do registro anterior: campo que a tela não mostra
 * (vínculos, datas de criação, classes da planilha mestre) continua igual.
 */
import type { Comboio, Empresa, Equipamento, EtapaServico, Funcionario, ObraLocal, ProdutoLubrificacao, TipoCombustivel } from '../../types';
import { EMPRESA_CLASSES, isSubSupplier, isSupplier, nextMasterId, type EmpresaTipo } from '../../masterData/centralRegistry';
import { validateEquipmentMasterRecord } from '../../utils/equipmentOperations';
import { TIPOS_POR_CATEGORIA_EMPRESA, isCategoriaEmpresa, type CadastroCategoriaId } from '../../utils/cadastrosCategorias';
import { TABELA_DA_CATEGORIA, type DadosCadastros, type RegistroCadastro } from '../../utils/cadastrosLista';

export type ValorCampo = string | boolean | string[];
export type ValoresCadastro = Record<string, ValorCampo>;

export interface OpcaoCampo {
  valor: string;
  label: string;
}

export interface CampoCadastro {
  id: string;
  label: string;
  tipo: 'texto' | 'numero' | 'data' | 'selecao' | 'marcar' | 'classes' | 'foto';
  obrigatorio?: boolean;
  /** Fica em "Mais informações". */
  extra?: boolean;
  placeholder?: string;
  ajuda?: string;
  maiusculas?: boolean;
  opcoes?: (dados: DadosCadastros, editandoId: string | null) => OpcaoCampo[];
  /** Mostra o campo só quando a condição vale para os valores atuais. */
  quando?: (valores: ValoresCadastro) => boolean;
}

// Classes que a tela não deixa marcar, mas que vêm da planilha mestre e
// precisam continuar no registro depois de uma edição.
const CLASSES_PRESERVADAS: readonly EmpresaTipo[] = ['GERADOR', 'ACEITANTE', 'TRANSPORTADORA'];
const SUBAREAS: readonly EmpresaTipo[] = ['LOCACAO_EQUIPAMENTOS', 'MATERIAIS', 'SUBFORNECEDOR'];

const opcoesEmpresas = (dados: DadosCadastros) => dados.empresas
  .filter(item => item.status !== 'INATIVO')
  .map(item => ({ valor: item.id, label: item.nome }));
const opcoesObras = (dados: DadosCadastros) => dados.obras.map(item => ({ valor: item.id, label: item.nome }));
const fixas = (...valores: string[]) => () => valores.map(valor => ({ valor, label: valor }));

const CAMPOS_EMPRESA: CampoCadastro[] = [
  { id: 'nome', label: 'Nome ou razão social', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Pedraforte Mineração' },
  { id: 'tipos', label: 'Classes', tipo: 'classes', obrigatorio: true, ajuda: 'Marque tudo que a empresa faz na obra.' },
  {
    id: 'fornecedorPrincipalId',
    label: 'Atende por meio de',
    tipo: 'selecao',
    quando: valores => Array.isArray(valores.tipos) && valores.tipos.includes('SUBFORNECEDOR'),
    opcoes: (dados, editandoId) => dados.empresas
      .filter(item => isSupplier(item) && !isSubSupplier(item) && item.id !== editandoId)
      .map(item => ({ valor: item.id, label: item.nome })),
  },
  { id: 'cnpj', label: 'CNPJ', tipo: 'texto', placeholder: '00.000.000/0000-00' },
  { id: 'telefone', label: 'Telefone', tipo: 'texto', placeholder: '(79) 99999-0000' },
  { id: 'responsavel', label: 'Responsável', tipo: 'texto', extra: true },
];

const CAMPOS_EQUIPAMENTO: CampoCadastro[] = [
  { id: 'prefixo', label: 'Prefixo', tipo: 'texto', obrigatorio: true, maiusculas: true, placeholder: 'Ex.: CB738' },
  { id: 'nome', label: 'Descrição', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Caminhão basculante' },
  { id: 'empresaId', label: 'Empresa proprietária', tipo: 'selecao', obrigatorio: true, opcoes: opcoesEmpresas },
  { id: 'tipo', label: 'Tipo', tipo: 'texto', placeholder: 'Ex.: Escavadeira' },
  { id: 'localAtualId', label: 'Local atual', tipo: 'selecao', opcoes: opcoesObras },
  { id: 'status', label: 'Situação', tipo: 'selecao', opcoes: fixas('Ativo', 'Mobilizado', 'Parado', 'Manutenção', 'Esperando motorista', 'Desmobilizado') },
  { id: 'placa', label: 'Placa', tipo: 'texto', maiusculas: true },
  { id: 'operadorResponsavelId', label: 'Operador responsável', tipo: 'selecao', opcoes: dados => dados.funcionarios.filter(item => item.ativo !== false).map(item => ({ valor: item.id, label: item.matricula ? `${item.nome} (${item.matricula})` : item.nome })) },
  { id: 'marca', label: 'Marca', tipo: 'texto', extra: true },
  { id: 'modelo', label: 'Modelo', tipo: 'texto', extra: true },
  { id: 'ano', label: 'Ano', tipo: 'numero', extra: true },
  { id: 'seriePlaca', label: 'Número de série', tipo: 'texto', maiusculas: true, extra: true },
  { id: 'categoriaFrota', label: 'Categoria da frota', tipo: 'selecao', extra: true, opcoes: fixas('Equipamento', 'Implemento') },
  { id: 'familia', label: 'Família', tipo: 'texto', extra: true },
  { id: 'codigoSge', label: 'Código SGE', tipo: 'texto', extra: true },
  { id: 'combustivelId', label: 'Combustível', tipo: 'selecao', extra: true, opcoes: dados => dados.combustiveis.map(item => ({ valor: item.id, label: item.nome })) },
  { id: 'capacidadeTanqueLitros', label: 'Tanque (litros)', tipo: 'numero', extra: true },
  { id: 'metaDisponibilidade', label: 'Meta de disponibilidade (%)', tipo: 'numero', extra: true },
  { id: 'mobilizado', label: 'Está mobilizado na obra', tipo: 'marcar', extra: true },
  { id: 'dataMobilizacao', label: 'Data de mobilização', tipo: 'data', extra: true },
  { id: 'dataDesmobilizacao', label: 'Data de desmobilização', tipo: 'data', extra: true },
  { id: 'equipamentoVinculadoId', label: 'Equipamento vinculado', tipo: 'selecao', extra: true, opcoes: (dados, editandoId) => dados.equipamentos.filter(item => item.id !== editandoId).map(item => ({ valor: item.id, label: `${item.prefixo} · ${item.nome}` })) },
  { id: 'horasDisponiveis', label: 'Horas disponíveis no período', tipo: 'numero', extra: true },
  { id: 'horasIndisponiveis', label: 'Horas paradas no período', tipo: 'numero', extra: true },
  { id: 'observacao', label: 'Observação', tipo: 'texto', extra: true },
  { id: 'foto', label: 'Foto', tipo: 'foto', extra: true },
];

export const CAMPOS: Record<CadastroCategoriaId, CampoCadastro[]> = {
  funcionarios: [
    { id: 'matricula', label: 'Matrícula', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: 01063' },
    { id: 'nome', label: 'Nome completo', tipo: 'texto', obrigatorio: true },
    { id: 'cargo', label: 'Função', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Operador de escavadeira' },
    { id: 'empresaId', label: 'Empresa', tipo: 'selecao', obrigatorio: true, opcoes: opcoesEmpresas },
    { id: 'status', label: 'Situação', tipo: 'selecao', opcoes: () => [
      { valor: 'ATIVO', label: 'Ativo' },
      { valor: 'FÉRIAS', label: 'Férias' },
      { valor: 'AFASTADO', label: 'Afastado' },
      { valor: 'INATIVO', label: 'Inativo' },
      { valor: 'DESMOBILIZADO', label: 'Desmobilizado' },
    ] },
    { id: 'telefone', label: 'Telefone', tipo: 'texto', placeholder: '(79) 99999-0000' },
    { id: 'liderId', label: 'Líder', tipo: 'selecao', opcoes: (dados, editandoId) => dados.funcionarios
      .filter(item => item.id !== editandoId && item.matricula && item.ativo !== false)
      .map(item => ({ valor: item.id, label: `${item.nome} (${item.matricula})` })) },
    { id: 'divisao', label: 'Divisão', tipo: 'texto', extra: true },
    { id: 'secao', label: 'Seção', tipo: 'texto', extra: true },
    { id: 'area', label: 'Área', tipo: 'texto', extra: true },
    { id: 'responsavelArea', label: 'Responsável da área', tipo: 'texto', extra: true },
    { id: 'dataMobilizacao', label: 'Data de mobilização', tipo: 'data', extra: true },
    { id: 'dataDesmobilizacao', label: 'Data de desmobilização', tipo: 'data', extra: true },
    { id: 'situacaoRh', label: 'Situação no RH', tipo: 'texto', extra: true },
    { id: 'observacao', label: 'Observação', tipo: 'texto', extra: true },
  ],
  empresas: CAMPOS_EMPRESA,
  terceiras: CAMPOS_EMPRESA,
  fornecedores: CAMPOS_EMPRESA,
  'fornecedores-locacao': CAMPOS_EMPRESA,
  'fornecedores-materiais': CAMPOS_EMPRESA,
  subfornecedores: CAMPOS_EMPRESA,
  equipamentos: CAMPOS_EQUIPAMENTO,
  veiculos: CAMPOS_EQUIPAMENTO.filter(campo => campo.id !== 'categoriaFrota'),
  comboios: [
    { id: 'nome', label: 'Identificação do comboio', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Comboio 01' },
    { id: 'placa', label: 'Placa', tipo: 'texto', obrigatorio: true, maiusculas: true },
    { id: 'capacidadeLitros', label: 'Capacidade (litros)', tipo: 'numero', obrigatorio: true },
    { id: 'responsavel', label: 'Motorista responsável', tipo: 'texto', obrigatorio: true },
  ],
  obras: [
    { id: 'nome', label: 'Nome do local', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Obra 3 · Marginal' },
    { id: 'endereco', label: 'Endereço ou cidade', tipo: 'texto', obrigatorio: true },
    { id: 'status', label: 'Situação', tipo: 'selecao', opcoes: fixas('Ativa', 'Planejada', 'Concluída') },
    { id: 'responsavel', label: 'Responsável', tipo: 'texto' },
  ],
  etapas: [{ id: 'nome', label: 'Nome do ramo ou trecho', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Ramo 1400' }],
  combustiveis: [{ id: 'nome', label: 'Nome do combustível', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: Diesel S10' }],
  lubrificantes: [{ id: 'nome', label: 'Nome do produto', tipo: 'texto', obrigatorio: true, placeholder: 'Ex.: 15W40' }],
};

export const CLASSES_DA_TELA = EMPRESA_CLASSES;

const texto = (valor: unknown) => (valor === undefined || valor === null ? '' : String(valor));

/** Valores com que o formulário abre: do registro, ou os padrões de um tipo novo. */
export const valoresIniciais = (
  categoria: CadastroCategoriaId,
  registro: RegistroCadastro | undefined,
  dados: DadosCadastros,
): ValoresCadastro => {
  const valores: ValoresCadastro = {};
  const fonte = (registro || {}) as unknown as Record<string, unknown>;
  CAMPOS[categoria].forEach(campo => {
    const atual = fonte[campo.id];
    if (campo.tipo === 'marcar') valores[campo.id] = Boolean(atual);
    else if (campo.tipo === 'classes') valores[campo.id] = [];
    else valores[campo.id] = texto(atual);
  });

  if (isCategoriaEmpresa(categoria)) {
    valores.tipos = registro
      ? ((registro as Empresa).tipos || []).filter(tipo => !CLASSES_PRESERVADAS.includes(tipo))
      : [...TIPOS_POR_CATEGORIA_EMPRESA[categoria]];
  }
  if (categoria === 'funcionarios') {
    const pessoa = registro as Funcionario | undefined;
    valores.status = pessoa?.status || (pessoa && !pessoa.ativo ? 'INATIVO' : 'ATIVO');
    const lider = pessoa?.liderMatricula ? dados.funcionarios.find(item => item.matricula === pessoa.liderMatricula) : undefined;
    valores.liderId = lider?.id || '';
  }
  if (categoria === 'equipamentos' || categoria === 'veiculos') {
    if (!registro) {
      valores.status = 'Ativo';
      valores.metaDisponibilidade = '80';
      valores.categoriaFrota = categoria === 'veiculos' ? 'Veículo' : 'Equipamento';
    } else {
      valores.categoriaFrota = (registro as Equipamento).categoriaFrota || 'Equipamento';
    }
  }
  if (categoria === 'obras' && !registro) valores.status = 'Ativa';
  if (categoria === 'comboios' && !registro) valores.capacidadeLitros = '3000';
  return valores;
};

const str = (valores: ValoresCadastro, id: string) => {
  const valor = valores[id];
  return typeof valor === 'string' ? valor.trim() : '';
};
const opcional = (valores: ValoresCadastro, id: string) => str(valores, id) || undefined;
const numero = (valores: ValoresCadastro, id: string) => {
  const valor = str(valores, id).replace(',', '.');
  if (!valor) return undefined;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : undefined;
};

/** Campos obrigatórios vazios, pelo rótulo que a pessoa vê. */
export const camposFaltando = (categoria: CadastroCategoriaId, valores: ValoresCadastro): string[] => CAMPOS[categoria]
  .filter(campo => campo.obrigatorio && (!campo.quando || campo.quando(valores)))
  .filter(campo => {
    const valor = valores[campo.id];
    return Array.isArray(valor) ? valor.length === 0 : typeof valor === 'string' ? !valor.trim() : false;
  })
  .map(campo => campo.id);

const PREFIXO_ID: Partial<Record<CadastroCategoriaId, string>> = {
  funcionarios: 'COL',
  equipamentos: 'EQ',
  veiculos: 'VEI',
  fornecedores: 'FOR',
  'fornecedores-locacao': 'FOR',
  'fornecedores-materiais': 'FOR',
  subfornecedores: 'FOR',
  terceiras: 'TER',
  empresas: 'EMP',
};

export const novoId = (categoria: CadastroCategoriaId, dados: DadosCadastros): string => {
  const prefixo = PREFIXO_ID[categoria];
  const tabela = TABELA_DA_CATEGORIA[categoria];
  if (prefixo) return nextMasterId(prefixo, (dados[tabela] as readonly { id: string }[]).map(item => item.id));
  return `${categoria.substring(0, 3).toUpperCase()}-${Date.now()}`;
};

export type ResultadoMontagem = { ok: true; registro: RegistroCadastro } | { ok: false; erro: string };

/**
 * Converte o formulário no registro que vai ser gravado. Parte do registro
 * anterior para não perder nada que a tela não mostra.
 */
export const montarRegistro = (
  categoria: CadastroCategoriaId,
  valores: ValoresCadastro,
  anterior: RegistroCadastro | undefined,
  id: string,
  dados: DadosCadastros,
): ResultadoMontagem => {
  const faltando = camposFaltando(categoria, valores);
  if (faltando.length > 0) {
    const nomes = CAMPOS[categoria].filter(campo => faltando.includes(campo.id)).map(campo => campo.label.toLowerCase());
    return { ok: false, erro: `Preencha ${nomes.join(', ')}.` };
  }

  if (isCategoriaEmpresa(categoria)) {
    const empresa = anterior as Empresa | undefined;
    const marcadas = (Array.isArray(valores.tipos) ? valores.tipos : []) as EmpresaTipo[];
    const subfornecedor = marcadas.includes('SUBFORNECEDOR');
    const registro: Empresa = {
      ...empresa,
      id,
      nome: str(valores, 'nome'),
      cnpj: str(valores, 'cnpj'),
      telefone: str(valores, 'telefone'),
      responsavel: str(valores, 'responsavel'),
      // Subárea marcada também conta como fornecedor; classes da planilha
      // que a tela não mostra continuam no registro.
      tipos: Array.from(new Set([
        ...(empresa?.tipos || []).filter(tipo => CLASSES_PRESERVADAS.includes(tipo)),
        ...marcadas,
        ...(marcadas.some(tipo => SUBAREAS.includes(tipo)) ? ['FORNECEDOR' as const] : []),
      ])),
      fornecedorPrincipalId: subfornecedor ? opcional(valores, 'fornecedorPrincipalId') : undefined,
      status: empresa?.status || 'ATIVO',
    };
    return { ok: true, registro };
  }

  if (categoria === 'funcionarios') {
    const pessoa = anterior as Funcionario | undefined;
    const lider = dados.funcionarios.find(item => item.id === str(valores, 'liderId'));
    const status = (str(valores, 'status') || 'ATIVO') as NonNullable<Funcionario['status']>;
    const registro: Funcionario = {
      ...pessoa,
      id,
      matricula: str(valores, 'matricula'),
      nome: str(valores, 'nome'),
      cargo: str(valores, 'cargo'),
      telefone: str(valores, 'telefone'),
      empresaId: str(valores, 'empresaId'),
      status,
      ativo: !['INATIVO', 'DESMOBILIZADO'].includes(status),
      liderMatricula: lider?.matricula,
      liderNome: lider?.nome,
      divisao: opcional(valores, 'divisao'),
      secao: opcional(valores, 'secao'),
      area: opcional(valores, 'area'),
      responsavelArea: opcional(valores, 'responsavelArea'),
      dataMobilizacao: opcional(valores, 'dataMobilizacao'),
      dataDesmobilizacao: opcional(valores, 'dataDesmobilizacao'),
      situacaoRh: opcional(valores, 'situacaoRh'),
      observacao: opcional(valores, 'observacao'),
    };
    return { ok: true, registro };
  }

  if (categoria === 'equipamentos' || categoria === 'veiculos') {
    const equipamento = anterior as Equipamento | undefined;
    const operador = dados.funcionarios.find(item => item.id === str(valores, 'operadorResponsavelId'));
    const status = (str(valores, 'status') || 'Ativo') as Equipamento['status'];
    const registro: Equipamento = {
      ...equipamento,
      id,
      prefixo: str(valores, 'prefixo').toUpperCase(),
      nome: str(valores, 'nome'),
      tipo: str(valores, 'tipo') || 'Outro',
      marca: str(valores, 'marca'),
      modelo: str(valores, 'modelo'),
      ano: numero(valores, 'ano'),
      seriePlaca: str(valores, 'seriePlaca').toUpperCase(),
      placa: str(valores, 'placa').toUpperCase() || undefined,
      empresaId: str(valores, 'empresaId'),
      status,
      // Sem local escolhido fica vazio: não inventa a primeira obra da lista.
      localAtualId: str(valores, 'localAtualId'),
      observacao: str(valores, 'observacao'),
      foto: opcional(valores, 'foto'),
      horasDisponiveis: numero(valores, 'horasDisponiveis'),
      horasIndisponiveis: numero(valores, 'horasIndisponiveis'),
      categoriaFrota: categoria === 'veiculos' ? 'Veículo' : (str(valores, 'categoriaFrota') || 'Equipamento') as Equipamento['categoriaFrota'],
      codigoSge: opcional(valores, 'codigoSge'),
      familia: opcional(valores, 'familia'),
      mobilizado: Boolean(valores.mobilizado),
      metaDisponibilidade: numero(valores, 'metaDisponibilidade'),
      dataMobilizacao: opcional(valores, 'dataMobilizacao'),
      dataDesmobilizacao: opcional(valores, 'dataDesmobilizacao'),
      operadorResponsavelId: operador?.id,
      operadorResponsavelNome: operador?.nome,
      combustivelId: opcional(valores, 'combustivelId'),
      capacidadeTanqueLitros: numero(valores, 'capacidadeTanqueLitros'),
      equipamentoVinculadoId: opcional(valores, 'equipamentoVinculadoId'),
    };
    const validacao = validateEquipmentMasterRecord(registro);
    if (validacao.errors.length > 0) return { ok: false, erro: validacao.errors.join(' ') };
    return { ok: true, registro };
  }

  if (categoria === 'comboios') {
    const capacidade = numero(valores, 'capacidadeLitros');
    if (!capacidade || capacidade <= 0) return { ok: false, erro: 'A capacidade precisa ser maior que zero.' };
    const registro: Comboio = {
      ...(anterior as Comboio | undefined),
      id,
      nome: str(valores, 'nome'),
      placa: str(valores, 'placa').toUpperCase(),
      capacidadeLitros: capacidade,
      responsavel: str(valores, 'responsavel'),
    };
    return { ok: true, registro };
  }

  if (categoria === 'obras') {
    const registro: ObraLocal = {
      ...(anterior as ObraLocal | undefined),
      id,
      nome: str(valores, 'nome'),
      endereco: str(valores, 'endereco'),
      responsavel: str(valores, 'responsavel'),
      status: (str(valores, 'status') || 'Ativa') as ObraLocal['status'],
    };
    return { ok: true, registro };
  }

  const registro: TipoCombustivel | ProdutoLubrificacao | EtapaServico = {
    ...(anterior as TipoCombustivel | undefined),
    id,
    nome: str(valores, 'nome'),
  };
  return { ok: true, registro };
};
