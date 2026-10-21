import { Boxes } from 'lucide-react';
import type { MovimentoMaterial } from '../../types';
import { formatarData, numero } from '../../utils/formato';
import { Badge, EmptyState, TabelaPadrao, type ColunaTabela } from '../../shared/ui';

const tomDoTipo = (tipo: MovimentoMaterial['tipo']) => (tipo === 'Entrada' ? 'success' : tipo === 'Saída' ? 'danger' : 'neutral');
const trajeto = (item: MovimentoMaterial) => [item.origem, item.destino].filter(Boolean).join(' → ');
const fornecedorENota = (item: MovimentoMaterial) => [item.fornecedorNome, item.notaFiscal && `NF ${item.notaFiscal}`].filter(Boolean).join(' · ');

const COLUNAS: ColunaTabela<MovimentoMaterial>[] = [
  {
    chave: 'material',
    titulo: 'Material',
    larguraMinima: 150,
    valorOrdenacao: item => item.materialDescricao,
    render: item => <span className={item.canceladoEm ? 'font-semibold text-slate-500' : 'font-semibold text-slate-900'}>{item.materialDescricao}</span>,
    dica: item => item.materialDescricao,
  },
  {
    chave: 'data',
    titulo: 'Data',
    valorOrdenacao: item => item.data,
    render: item => (
      <>
        <span className="block whitespace-nowrap tabular-nums">{formatarData(item.data)}</span>
        {item.responsavel && <span className="block max-w-[9rem] truncate text-xs text-slate-600" title={item.responsavel}>{item.responsavel}</span>}
      </>
    ),
  },
  {
    chave: 'tipo',
    titulo: 'Tipo',
    valorOrdenacao: item => (item.canceladoEm ? 'Desfeito' : item.tipo),
    render: item => (item.canceladoEm
      ? <Badge tone="neutral">Desfeito</Badge>
      : <Badge tone={tomDoTipo(item.tipo)}>{item.tipo === 'Transferência' ? 'Transporte' : item.tipo}</Badge>),
  },
  {
    chave: 'quantidade',
    titulo: 'Quantidade',
    alinhamento: 'direita',
    valorOrdenacao: item => item.quantidade,
    render: item => <strong className={item.canceladoEm ? 'whitespace-nowrap text-slate-500 line-through' : 'whitespace-nowrap text-slate-900'}>{numero(item.quantidade)} {item.unidade}</strong>,
  },
  { chave: 'trajeto', titulo: 'De onde → para onde', larguraMinima: 120, valorOrdenacao: trajeto, render: item => trajeto(item) || '—' },
  { chave: 'fornecedor', titulo: 'Fornecedor / nota', larguraMinima: 120, valorOrdenacao: fornecedorENota, render: item => fornecedorENota(item) || '—' },
];

interface MovimentosProps {
  movimentos: readonly MovimentoMaterial[];
  /** Muda quando a busca muda: a lista volta para a primeira página. */
  chave: string;
  /** Com seleção, cada movimento ganha uma caixa para marcar vários. */
  selecao?: {
    marcados: ReadonlySet<string>;
    onAlternar: (id: string) => void;
    onAlternarVarios: (ids: string[], marcar: boolean) => void;
  };
  /** Tocar no movimento abre para editar. */
  onAbrir?: (movimento: MovimentoMaterial) => void;
}

/**
 * Lista de movimentos, do mais recente para o mais antigo. Com a planilha de
 * agregados são mais de 11 mil linhas: a TabelaPadrao desenha uma página por
 * vez (50 por padrão) e a busca continua olhando todos. No celular cada
 * movimento vira um cartão, sem rolar para o lado.
 */
export function ListaMovimentos({ movimentos, chave, selecao, onAbrir }: MovimentosProps) {
  return (
    <TabelaPadrao
      key={chave}
      titulo="Movimentos de material"
      linhas={movimentos}
      colunas={COLUNAS}
      idDaLinha={item => item.id}
      nomeDoItem={{ um: 'movimento', varios: 'movimentos' }}
      vazio={<EmptyState icon={Boxes} title="Nenhum movimento" description="Use Novo lançamento ou importe a planilha." />}
      onAbrirLinha={onAbrir}
      classeLinha={item => (item.canceladoEm ? 'text-slate-500' : undefined)}
      selecao={selecao && {
        ...selecao,
        rotulo: item => `Marcar ${item.tipo.toLocaleLowerCase('pt-BR')} de ${item.materialDescricao} em ${formatarData(item.data)}`,
      }}
    />
  );
}
