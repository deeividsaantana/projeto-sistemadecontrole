import { useMemo } from 'react';
import { SearchX } from 'lucide-react';
import type { ColunaCadastro, LinhaCadastro } from '../../utils/cadastrosLista';
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui';
import { BOTAO_SECUNDARIO, TOM_SITUACAO } from './estilos';

interface Props {
  /** Nome da lista para leitor de tela (o tipo de cadastro aberto). */
  titulo: string;
  linhas: LinhaCadastro[];
  colunas: ColunaCadastro[];
  mostrarSituacao: boolean;
  ordem: { coluna: string; direcao: 'asc' | 'desc' };
  onOrdenar: (coluna: string) => void;
  pagina: number;
  onPagina: (pagina: number) => void;
  selecionadoId: string | null;
  onAbrir: (linha: LinhaCadastro) => void;
  vazio: { titulo: string; texto: string; acao?: { label: string; onClick: () => void } };
  /** Com seleção, cada linha ganha uma caixa para marcar e excluir vários de uma vez. */
  selecao?: {
    marcados: ReadonlySet<string>;
    onAlternar: (id: string) => void;
    onAlternarPagina: (ids: string[], marcar: boolean) => void;
  };
}

/** Coluna principal ganha mais espaço; código e número ficam estreitos. */
const larguraDa = (coluna: ColunaCadastro) => (coluna.larga ? 220 : coluna.codigo ? 96 : 130);

/**
 * Lista de Cadastros na TabelaPadrao: tabela no computador e cartões no
 * celular, da mesma lista já filtrada e ordenada pela aba. A linha inteira
 * abre o detalhe (clique, Enter ou Espaço): não há ícone pequeno para acertar.
 * Texto longo quebra em até duas linhas em vez de cortar com reticências.
 */
export default function CadastroLista({ titulo, linhas, colunas, mostrarSituacao, ordem, onOrdenar, pagina, onPagina, selecionadoId, onAbrir, vazio, selecao }: Props) {
  const colunasTabela = useMemo<ColunaTabela<LinhaCadastro>[]>(() => [
    ...colunas.map((coluna, indice): ColunaTabela<LinhaCadastro> => ({
      chave: coluna.id,
      titulo: coluna.label,
      larguraMinima: larguraDa(coluna),
      noCartao: !coluna.secundaria,
      valorOrdenacao: linha => linha.colunas[coluna.id],
      dica: linha => linha.colunas[coluna.id] || undefined,
      render: linha => {
        const valor = linha.colunas[coluna.id];
        if (!valor) return <span className="text-slate-400">—</span>;
        if (indice === 0 || coluna.id === 'nome') return <span className={`font-semibold ${linha.ativo ? 'text-slate-900' : 'text-slate-500'}`}>{valor}</span>;
        return coluna.codigo ? <span className="tabular-nums">{valor}</span> : valor;
      },
    })),
    ...(mostrarSituacao ? [{
      chave: 'situacao',
      titulo: 'Situação',
      valorOrdenacao: (linha: LinhaCadastro) => linha.situacao,
      render: (linha: LinhaCadastro) => <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${TOM_SITUACAO[linha.tom]}`}>{linha.situacao}</span>,
    }] : []),
  ], [colunas, mostrarSituacao]);

  return (
    <TabelaPadrao
      titulo={titulo}
      linhas={linhas}
      colunas={colunasTabela}
      idDaLinha={linha => linha.id}
      nomeDoItem={{ um: 'cadastro', varios: 'cadastros' }}
      ordenacao={{ chave: ordem.coluna, direcao: ordem.direcao }}
      onOrdenar={onOrdenar}
      pagina={pagina}
      onPagina={onPagina}
      onAbrirLinha={onAbrir}
      linhaAtivaId={selecionadoId}
      classeLinha={linha => (linha.ativo ? undefined : 'text-slate-500')}
      selecao={selecao && {
        marcados: selecao.marcados,
        onAlternar: selecao.onAlternar,
        onAlternarVarios: selecao.onAlternarPagina,
        rotulo: linha => `Marcar ${linha.titulo}`,
      }}
      testId="cadastro-lista"
      vazio={(
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center" data-testid="cadastro-lista-vazia">
          <SearchX className="size-8 text-slate-400" aria-hidden="true" />
          <p className="text-base font-bold text-slate-800">{vazio.titulo}</p>
          <p className="max-w-sm text-sm text-slate-600">{vazio.texto}</p>
          {vazio.acao && <button type="button" onClick={vazio.acao.onClick} className={`${BOTAO_SECUNDARIO} mt-2`}>{vazio.acao.label}</button>}
        </div>
      )}
    />
  );
}
