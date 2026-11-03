/**
 * Relatório unificado com 3 abas:
 * 1. Visão Geral: KPI cards com status
 * 2. Detalhado: tabela com filtros, busca e paginação
 * 3. Editável: form inline com validação em tempo real
 */
import { useState } from 'react';
import { Eye, Pencil, Trash2, TrendingUp, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { AbasDaTela } from '../../shared/ui/AbasDaTela';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, ROTULO } from '../cadastros/estilos';

export interface KPICard {
  id: string;
  titulo: string;
  valor: number | string;
  sufixo?: string;
  variacao?: number;
  status: 'bom' | 'atencao' | 'critico';
  icone: React.ReactNode;
}

export interface LinhaDados {
  id: string;
  codigo: string;
  descricao: string;
  valor: number | string;
  status: 'ativo' | 'parado' | 'critico';
  [key: string]: unknown;
}

export interface CampoEditavel {
  nome: string;
  label: string;
  tipo: 'text' | 'number' | 'date' | 'select';
  obrigatorio?: boolean;
  opcoes?: { valor: string; label: string }[];
  validacao?: (valor: string) => string | undefined;
}

interface Props {
  titulo: string;
  descricao?: string;
  kpis: KPICard[];
  linhas: LinhaDados[];
  colunas: Array<{
    chave: string;
    titulo: string;
    largura?: string;
  }>;
  campos: CampoEditavel[];
  paginacao?: {
    pagina: number;
    totalPorPagina: number;
    total: number;
  };
  onEditar?: (linha: LinhaDados) => void;
  onExcluir?: (id: string) => void;
  onBuscar?: (termo: string) => void;
  onFiltrar?: (campo: string, valor: string) => void;
  onSalvarEdicao?: (dados: Record<string, unknown>) => void;
  onMudarPagina?: (pagina: number) => void;
}

const TOM_STATUS = {
  bom: 'bg-emerald-100 text-emerald-900',
  atencao: 'bg-amber-100 text-amber-900',
  critico: 'bg-rose-100 text-rose-900',
};

const TOM_LINHA = {
  ativo: 'hover:bg-emerald-50',
  parado: 'hover:bg-amber-50',
  critico: 'hover:bg-rose-50',
};

const ICONE_STATUS = {
  bom: CheckCircle2,
  atencao: AlertCircle,
  critico: AlertCircle,
};

export function RelatorioUnificado({
  titulo,
  descricao,
  kpis,
  linhas,
  colunas,
  campos,
  paginacao,
  onEditar,
  onExcluir,
  onBuscar,
  onFiltrar,
  onSalvarEdicao,
  onMudarPagina,
}: Props) {
  const [abaAtiva, setAbaAtiva] = useState<'visao' | 'detalhado' | 'editavel'>('visao');
  const [busca, setBusca] = useState('');
  const [edicao, setEdicao] = useState<Record<string, unknown> | null>(null);
  const [errosEdicao, setErrosEdicao] = useState<Record<string, string>>({});

  const validarCampo = (campo: CampoEditavel, valor: string): string | undefined => {
    if (campo.obrigatorio && !valor) return `${campo.label} é obrigatório`;
    if (campo.validacao) return campo.validacao(valor);
    return undefined;
  };

  const aoMudarCampo = (nomeCampo: string, valor: string) => {
    const campo = campos.find(c => c.nome === nomeCampo);
    if (!campo) return;

    const erro = validarCampo(campo, valor);
    setErrosEdicao(atual => {
      const novos = { ...atual };
      if (erro) novos[nomeCampo] = erro;
      else delete novos[nomeCampo];
      return novos;
    });

    setEdicao(atual => ({ ...atual, [nomeCampo]: valor }));
  };

  const aoSalvarEdicao = () => {
    if (!edicao || Object.keys(errosEdicao).length > 0) return;
    onSalvarEdicao?.(edicao);
    setEdicao(null);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-black text-slate-900">{titulo}</h1>
        {descricao && <p className="mt-2 text-sm text-slate-600">{descricao}</p>}
      </div>

      {/* Abas */}
      <AbasDaTela
        abas={[
          { id: 'visao', rotulo: 'Visão Geral' },
          { id: 'detalhado', rotulo: 'Detalhado' },
          { id: 'editavel', rotulo: 'Editável' },
        ]}
        ativa={abaAtiva}
        onTrocar={(id) => setAbaAtiva(id as typeof abaAtiva)}
        rotulo="Abas do relatório"
      />

      {/* ABA 1: VISÃO GERAL - KPI Cards */}
      {abaAtiva === 'visao' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {kpis.map((kpi) => {
            const IconeStatus = ICONE_STATUS[kpi.status];
            return (
              <div
                key={kpi.id}
                className={`${CARTAO} p-4 flex flex-col gap-3 hover:shadow-md transition duration-300`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{kpi.titulo}</p>
                    <p className="mt-2 text-2xl font-black text-slate-900 tabular-nums">
                      {typeof kpi.valor === 'number' ? kpi.valor.toLocaleString('pt-BR') : kpi.valor}
                      {kpi.sufixo && <span className="text-sm text-slate-600 ml-1">{kpi.sufixo}</span>}
                    </p>
                  </div>
                  <div className={`grid size-10 place-items-center rounded-lg flex-shrink-0 ${TOM_STATUS[kpi.status]}`}>
                    <IconeStatus className="size-5" aria-hidden="true" />
                  </div>
                </div>
                {kpi.variacao !== undefined && (
                  <div className="text-xs font-semibold text-slate-600">
                    {kpi.variacao > 0 ? '↑' : '↓'} {Math.abs(kpi.variacao)}% vs período anterior
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ABA 2: DETALHADO - Tabela com Filtros */}
      {abaAtiva === 'detalhado' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <label className="relative flex-1 min-w-0">
              <span className="sr-only">Buscar</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" aria-hidden="true" />
              <input
                type="text"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  onBuscar?.(e.target.value);
                }}
                placeholder="Buscar código, descrição..."
                className={`${CAMPO} pl-9 w-full`}
              />
            </label>
            <select onChange={(e) => onFiltrar?.('status', e.target.value)} className={`${CAMPO} flex-none`}>
              <option value="">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="parado">Parado</option>
              <option value="critico">Crítico</option>
            </select>
          </div>

          {/* Tabela */}
          <div className={`${CARTAO} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-50">
                  {colunas.map((coluna) => (
                    <th
                      key={coluna.chave}
                      className="text-left font-bold text-slate-900 px-4 py-3"
                      style={{ width: coluna.largura }}
                    >
                      {coluna.titulo}
                    </th>
                  ))}
                  <th className="text-right font-bold text-slate-900 px-4 py-3 w-24">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.id} className={`border-b border-slate-100 transition duration-200 ${TOM_LINHA[linha.status]}`}>
                    {colunas.map((coluna) => (
                      <td
                        key={`${linha.id}-${coluna.chave}`}
                        className="px-4 py-3 text-slate-900"
                        style={{ width: coluna.largura }}
                      >
                        {coluna.chave === 'codigo' ? (
                          <strong className="font-mono">{String(linha[coluna.chave])}</strong>
                        ) : (
                          <span className="text-slate-700">{String(linha[coluna.chave])}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => onEditar?.(linha)}
                          className="p-2 hover:bg-slate-200 rounded-lg transition"
                          title="Editar"
                          aria-label={`Editar ${linha.codigo}`}
                        >
                          <Pencil className="size-4 text-slate-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onExcluir?.(linha.id)}
                          className="p-2 hover:bg-rose-100 rounded-lg transition"
                          title="Excluir"
                          aria-label={`Excluir ${linha.codigo}`}
                        >
                          <Trash2 className="size-4 text-rose-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {paginacao && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Mostrando {(paginacao.pagina - 1) * paginacao.totalPorPagina + 1} a{' '}
                {Math.min(paginacao.pagina * paginacao.totalPorPagina, paginacao.total)} de {paginacao.total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => onMudarPagina?.(paginacao.pagina - 1)}
                  disabled={paginacao.pagina === 1}
                  className={`px-3 py-1.5 rounded-lg border transition ${paginacao.pagina === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                >
                  ← Anterior
                </button>
                <span className="px-3 py-1.5">Página {paginacao.pagina}</span>
                <button
                  onClick={() => onMudarPagina?.(paginacao.pagina + 1)}
                  disabled={paginacao.pagina * paginacao.totalPorPagina >= paginacao.total}
                  className={`px-3 py-1.5 rounded-lg border transition ${paginacao.pagina * paginacao.totalPorPagina >= paginacao.total ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: EDITÁVEL - Form com Validação */}
      {abaAtiva === 'editavel' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            aoSalvarEdicao();
          }}
          className={`${CARTAO} space-y-4 p-5`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {campos.map((campo) => (
              <label key={campo.nome} className="space-y-1.5 block">
                <span className={ROTULO}>
                  {campo.label}
                  {campo.obrigatorio && <span className="text-rose-600">*</span>}
                </span>
                {campo.tipo === 'select' ? (
                  <select
                    value={String(edicao?.[campo.nome] ?? '')}
                    onChange={(e) => aoMudarCampo(campo.nome, e.target.value)}
                    className={`${CAMPO} w-full`}
                    aria-describedby={errosEdicao[campo.nome] ? `erro-${campo.nome}` : undefined}
                  >
                    <option value="">Selecionar...</option>
                    {campo.opcoes?.map((opt) => (
                      <option key={opt.valor} value={opt.valor}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={campo.tipo}
                    value={String(edicao?.[campo.nome] ?? '')}
                    onChange={(e) => aoMudarCampo(campo.nome, e.target.value)}
                    className={`${CAMPO} w-full`}
                    required={campo.obrigatorio}
                    aria-describedby={errosEdicao[campo.nome] ? `erro-${campo.nome}` : undefined}
                  />
                )}
                {errosEdicao[campo.nome] && (
                  <p id={`erro-${campo.nome}`} role="alert" className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="size-3" aria-hidden="true" />
                    {errosEdicao[campo.nome]}
                  </p>
                )}
                {!errosEdicao[campo.nome] && edicao?.[campo.nome] && (
                  <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    Validado
                  </p>
                )}
              </label>
            ))}
          </div>

          {/* Botões */}
          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setEdicao(null)} className={`${BOTAO_SECUNDARIO}`}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={Object.keys(errosEdicao).length > 0 || !edicao}
              className={`${BOTAO_PRIMARIO} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Salvar alterações
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
