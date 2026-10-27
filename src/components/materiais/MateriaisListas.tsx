import { Boxes, Eye, Layers, ListOrdered, Package, Pencil, Undo2, type LucideIcon } from 'lucide-react';
import type { Material, MovimentoMaterial } from '../../types';
import { formatarData, numero } from '../../utils/formato';
import { Badge, CountUp, EmptyState, TabelaPadrao, type ColunaTabela } from '../../shared/ui';
import { CARTAO, FOCO } from '../cadastros/estilos';

const tomDoTipo = (tipo: MovimentoMaterial['tipo']) => (tipo === 'Entrada' ? 'success' : tipo === 'Saída' ? 'danger' : 'neutral');
const trajeto = (item: MovimentoMaterial) => [item.origem, item.destino].filter(Boolean).join(' → ');
const fornecedorENota = (item: MovimentoMaterial) => [item.fornecedorNome, item.notaFiscal && `NF ${item.notaFiscal}`].filter(Boolean).join(' · ');
const placaETicket = (item: MovimentoMaterial) => [item.placa, item.ticket && `Ticket ${item.ticket}`].filter(Boolean).join(' · ');

/** Código em destaque em cima e a descrição em cinza embaixo, como a UA no SGE. */
const DuasLinhas = ({ principal, detalhe, apagado = false }: { principal: string; detalhe?: string; apagado?: boolean }) => (
  <>
    <span className={`block font-bold ${apagado ? 'text-slate-500' : detalhe ? 'text-[#176b4d]' : 'text-slate-900'}`}>{principal}</span>
    {detalhe && <span className="block text-xs text-slate-600">{detalhe}</span>}
  </>
);

const BOTAO_ACAO = `grid size-11 place-items-center rounded-lg border transition duration-200 md:size-8 ${FOCO}`;

interface MovimentosProps {
  movimentos: readonly MovimentoMaterial[];
  /** Para mostrar o código do material na lista. */
  materiaisPorId: ReadonlyMap<string, Material>;
  /** Muda quando a busca muda: a lista volta para a primeira página. */
  chave: string;
  /** Com seleção, cada movimento ganha uma caixa para marcar vários. */
  selecao?: {
    marcados: ReadonlySet<string>;
    onAlternar: (id: string) => void;
    onAlternarVarios: (ids: string[], marcar: boolean) => void;
  };
  /** Tocar no movimento (ou no lápis) abre para editar. */
  onAbrir?: (movimento: MovimentoMaterial) => void;
  /** Olho: abre a ficha do material. Sem ele (dentro da própria ficha) o olho some. */
  onVer?: (movimento: MovimentoMaterial) => void;
  /** Desfazer: o lançamento fica no histórico, marcado, e sai do saldo. */
  onDesfazer?: (movimento: MovimentoMaterial) => void;
}

/**
 * Lista de movimentos no molde da Apropriação de Viagens do SGE: data e tipo
 * na frente, material com código em destaque, origem → destino, nota e placa,
 * e as ações ver, editar e desfazer na última coluna. Com a planilha de
 * agregados são mais de 11 mil linhas: a TabelaPadrao desenha uma página por
 * vez e a busca continua olhando todos. No celular cada movimento vira cartão.
 */
export function ListaMovimentos({ movimentos, materiaisPorId, chave, selecao, onAbrir, onVer, onDesfazer }: MovimentosProps) {
  const colunas: ColunaTabela<MovimentoMaterial>[] = [
    {
      chave: 'data',
      titulo: 'Data',
      valorOrdenacao: item => item.data,
      render: item => (
        <>
          <span className="block whitespace-nowrap font-semibold tabular-nums text-slate-900">{formatarData(item.data)}</span>
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
      chave: 'material',
      titulo: 'Material',
      larguraMinima: 180,
      valorOrdenacao: item => item.materialDescricao,
      render: item => {
        const codigo = materiaisPorId.get(item.materialId)?.codigo;
        return codigo
          ? <DuasLinhas principal={codigo} detalhe={item.materialDescricao} apagado={Boolean(item.canceladoEm)} />
          : <DuasLinhas principal={item.materialDescricao} apagado={Boolean(item.canceladoEm)} />;
      },
      dica: item => item.materialDescricao,
    },
    {
      chave: 'trajeto',
      titulo: 'Origem × destino',
      larguraMinima: 150,
      valorOrdenacao: item => item.etapaServicoNome || trajeto(item),
      render: item => (item.etapaServicoNome || trajeto(item)
        ? <>
          <span className="block font-semibold text-slate-900">{item.etapaServicoNome || item.destino}</span>
          {trajeto(item) && trajeto(item) !== item.etapaServicoNome && <span className="block text-xs text-slate-600">{trajeto(item)}</span>}
        </>
        : '—'),
    },
    { chave: 'fornecedor', titulo: 'Fornecedor / nota', larguraMinima: 120, valorOrdenacao: fornecedorENota, render: item => fornecedorENota(item) || '—' },
    { chave: 'placa', titulo: 'Placa / ticket', valorOrdenacao: placaETicket, render: item => placaETicket(item) || '—' },
    {
      chave: 'quantidade',
      titulo: 'Qtd.',
      alinhamento: 'direita',
      valorOrdenacao: item => item.quantidade,
      render: item => (
        <strong className={`whitespace-nowrap ${item.canceladoEm ? 'text-slate-500 line-through' : item.tipo === 'Entrada' ? 'text-[#176b4d]' : item.tipo === 'Saída' ? 'text-rose-700' : 'text-slate-900'}`}>
          {numero(item.quantidade)} {item.unidade}
        </strong>
      ),
    },
  ];

  return (
    <TabelaPadrao
      key={chave}
      titulo="Movimentos de material"
      linhas={movimentos}
      colunas={colunas}
      idDaLinha={item => item.id}
      nomeDoItem={{ um: 'movimento', varios: 'movimentos' }}
      vazio={<EmptyState icon={Boxes} title="Nenhum movimento" description="Use Novo lançamento ou importe a planilha." />}
      onAbrirLinha={onAbrir}
      classeLinha={item => (item.canceladoEm ? 'text-slate-500' : undefined)}
      acoes={onVer || onAbrir || onDesfazer ? item => (
        <span className="flex items-center justify-end gap-1.5">
          {onVer && (
            <button type="button" onClick={() => onVer(item)} aria-label={`Ver ficha de ${item.materialDescricao}`} title="Ver ficha do material" className={`${BOTAO_ACAO} border-slate-200 bg-white text-slate-600 hover:border-emerald-500 hover:text-[#176b4d]`}>
              <Eye className="size-4" aria-hidden="true" />
            </button>
          )}
          {onAbrir && (
            <button type="button" onClick={() => onAbrir(item)} aria-label={`Editar ${item.tipo.toLocaleLowerCase('pt-BR')} de ${item.materialDescricao} em ${formatarData(item.data)}`} title="Editar" className={`${BOTAO_ACAO} border-slate-200 bg-white text-slate-600 hover:border-emerald-500 hover:text-[#176b4d]`}>
              <Pencil className="size-4" aria-hidden="true" />
            </button>
          )}
          {onDesfazer && !item.canceladoEm && (
            <button type="button" onClick={() => onDesfazer(item)} aria-label={`Desfazer ${item.tipo.toLocaleLowerCase('pt-BR')} de ${item.materialDescricao} em ${formatarData(item.data)}`} title="Desfazer (sai do saldo, fica no histórico)" className={`${BOTAO_ACAO} border-rose-200 bg-white text-rose-700 hover:bg-rose-50`}>
              <Undo2 className="size-4" aria-hidden="true" />
            </button>
          )}
        </span>
      ) : undefined}
      selecao={selecao && {
        ...selecao,
        rotulo: item => `Marcar ${item.tipo.toLocaleLowerCase('pt-BR')} de ${item.materialDescricao} em ${formatarData(item.data)}`,
      }}
    />
  );
}

export interface LinhaAgrupada {
  material: Material | undefined;
  materialId: string;
  descricao: string;
  unidade: string;
  lancamentos: number;
  entradas: number;
  saidas: number;
  ultima: string;
}

/**
 * Movimentos somados por material, como o "Agrupado (UA)" do SGE. Cada linha
 * tem um material só, então entradas e saídas ficam na unidade dele; nada de
 * somar unidades diferentes. Desfeitos não entram.
 */
export const agruparPorMaterial = (movimentos: readonly MovimentoMaterial[], materiaisPorId: ReadonlyMap<string, Material>): LinhaAgrupada[] => {
  const porMaterial = new Map<string, LinhaAgrupada>();
  movimentos.forEach(item => {
    if (item.canceladoEm) return;
    const linha = porMaterial.get(item.materialId) ?? {
      material: materiaisPorId.get(item.materialId), materialId: item.materialId, descricao: item.materialDescricao, unidade: item.unidade, lancamentos: 0, entradas: 0, saidas: 0, ultima: '',
    };
    linha.lancamentos += 1;
    if (item.tipo === 'Entrada') linha.entradas += Math.abs(item.quantidade);
    if (item.tipo === 'Saída') linha.saidas += Math.abs(item.quantidade);
    if (item.data > linha.ultima) linha.ultima = item.data;
    porMaterial.set(item.materialId, linha);
  });
  return [...porMaterial.values()];
};

export function ListaAgrupada({ linhas, chave, onVer }: { linhas: LinhaAgrupada[]; chave: string; onVer: (materialId: string) => void }) {
  const colunas: ColunaTabela<LinhaAgrupada>[] = [
    {
      chave: 'material',
      titulo: 'Material',
      larguraMinima: 220,
      valorOrdenacao: linha => linha.descricao,
      render: linha => (linha.material?.codigo ? <DuasLinhas principal={linha.material.codigo} detalhe={linha.descricao} /> : <DuasLinhas principal={linha.descricao} />),
    },
    { chave: 'categoria', titulo: 'Categoria', valorOrdenacao: linha => linha.material?.categoria, render: linha => linha.material?.categoria || '—' },
    {
      chave: 'lancamentos',
      titulo: 'Lançamentos',
      alinhamento: 'direita',
      valorOrdenacao: linha => linha.lancamentos,
      render: linha => <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-[#176b4d] ring-1 ring-inset ring-emerald-200">{numero(linha.lancamentos)}</span>,
    },
    { chave: 'entradas', titulo: 'Entradas', alinhamento: 'direita', valorOrdenacao: linha => linha.entradas, render: linha => <strong className="whitespace-nowrap text-[#176b4d]">{numero(linha.entradas)} {linha.unidade}</strong> },
    { chave: 'saidas', titulo: 'Saídas', alinhamento: 'direita', valorOrdenacao: linha => linha.saidas, render: linha => <strong className="whitespace-nowrap text-rose-700">{numero(linha.saidas)} {linha.unidade}</strong> },
    {
      chave: 'diferenca',
      titulo: 'Entrou − saiu',
      alinhamento: 'direita',
      valorOrdenacao: linha => linha.entradas - linha.saidas,
      render: linha => <strong className={`whitespace-nowrap ${linha.entradas - linha.saidas < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{numero(linha.entradas - linha.saidas)} {linha.unidade}</strong>,
    },
    { chave: 'ultima', titulo: 'Último', valorOrdenacao: linha => linha.ultima, render: linha => <span className="tabular-nums">{formatarData(linha.ultima)}</span> },
  ];
  return (
    <TabelaPadrao
      key={chave}
      titulo="Movimentos agrupados por material"
      linhas={linhas}
      colunas={colunas}
      idDaLinha={linha => linha.materialId}
      nomeDoItem={{ um: 'material', varios: 'materiais' }}
      ordenacaoInicial={{ chave: 'lancamentos', direcao: 'desc' }}
      vazio={<EmptyState icon={Boxes} title="Nenhum movimento" description="Nada no período e na busca escolhidos." />}
      onAbrirLinha={linha => onVer(linha.materialId)}
      acoes={linha => (
        <button type="button" onClick={() => onVer(linha.materialId)} aria-label={`Ver ficha de ${linha.descricao}`} title="Ver ficha do material" className={`${BOTAO_ACAO} border-slate-200 bg-white text-slate-600 hover:border-emerald-500 hover:text-[#176b4d]`}>
          <Eye className="size-4" aria-hidden="true" />
        </button>
      )}
    />
  );
}

/** Cartões de total no topo da lista, como os do SGE: ícone, nome e número. */
export function ResumoMovimentos({ movimentos }: { movimentos: readonly MovimentoMaterial[] }) {
  const valendo = movimentos.filter(item => !item.canceladoEm);
  const entradas = valendo.filter(item => item.tipo === 'Entrada').length;
  const saidas = valendo.filter(item => item.tipo === 'Saída').length;
  const materiais = new Set(valendo.map(item => item.materialId)).size;
  const cartoes: Array<{ rotulo: string; valor: number; detalhe: string; Icone: LucideIcon; tom: string }> = [
    { rotulo: 'Total de lançamentos', valor: movimentos.length, detalhe: movimentos.length === valendo.length ? 'no filtro' : `${numero(movimentos.length - valendo.length)} desfeito(s)`, Icone: Layers, tom: 'bg-emerald-50 text-[#176b4d]' },
    { rotulo: 'Entradas e saídas', valor: entradas + saidas, detalhe: `${numero(entradas)} entradas · ${numero(saidas)} saídas`, Icone: ListOrdered, tom: 'bg-emerald-50 text-[#176b4d]' },
    { rotulo: 'Materiais movimentados', valor: materiais, detalhe: 'diferentes no filtro', Icone: Package, tom: 'bg-slate-100 text-slate-700' },
  ];
  return (
    <section aria-label="Totais dos movimentos" className="grid grid-cols-3 gap-2 lg:gap-3">
      {cartoes.map(({ rotulo, valor, detalhe, Icone, tom }) => (
        <div key={rotulo} className={`${CARTAO} flex min-w-0 items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3`}>
          <span className={`hidden size-10 shrink-0 place-items-center rounded-xl sm:grid ${tom}`}>
            <Icone className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold leading-tight text-slate-600 sm:text-sm">{rotulo}</span>
            <span className="flex flex-wrap items-baseline gap-x-2">
              <CountUp value={valor} className="text-2xl font-black tabular-nums text-slate-950" />
              <span className="hidden truncate text-xs text-slate-600 sm:inline">{detalhe}</span>
            </span>
          </span>
        </div>
      ))}
    </section>
  );
}
