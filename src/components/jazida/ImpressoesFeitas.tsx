import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';
import { normalizeTicketNumber } from '../../utils/ticketNumberSequence';
import type { PrintedTicketBatch } from './constantes';
import { Numeros } from './Numeros';

export interface LinhaDeImpressao extends PrintedTicketBatch {
  displayStart: number;
  displayEnd: number;
  total: number;
  liberacoes: number;
  recebimentos: number;
  completas: number;
  pendentes: number;
}

interface ImpressoesFeitasProps {
  linhas: readonly LinhaDeImpressao[];
  totais: { total: number; liberacoes: number; recebimentos: number; completas: number; pendentes: number };
}

const colunas: ColunaTabela<LinhaDeImpressao>[] = [
  { chave: 'quando', titulo: 'Impresso em', render: r => new Date(r.criadoEm).toLocaleString('pt-BR'), valorOrdenacao: r => r.criadoEm, larguraMinima: 160 },
  { chave: 'faixa', titulo: 'Números', render: r => `${normalizeTicketNumber(r.displayStart)} a ${normalizeTicketNumber(r.displayEnd)}`, valorOrdenacao: r => r.displayStart },
  { chave: 'modo', titulo: 'Como saiu', render: r => (r.modo === 'Pré-preenchido' ? 'Com dados do caminhão' : 'Só o número') },
  { chave: 'total', titulo: 'Tickets', alinhamento: 'direita', render: r => r.total, valorOrdenacao: r => r.total },
  { chave: 'liberacoes', titulo: 'Liberações de volta', alinhamento: 'direita', render: r => r.liberacoes, valorOrdenacao: r => r.liberacoes },
  { chave: 'recebimentos', titulo: 'Recebimentos de volta', alinhamento: 'direita', render: r => r.recebimentos, valorOrdenacao: r => r.recebimentos },
  { chave: 'completas', titulo: 'Completos', alinhamento: 'direita', render: r => <b className="text-[#176b4d]">{r.completas}</b>, valorOrdenacao: r => r.completas },
  { chave: 'pendentes', titulo: 'Faltando', alinhamento: 'direita', render: r => r.pendentes, valorOrdenacao: r => r.pendentes },
];

/** Blocos de tickets já impressos, com quantas vias de cada bloco voltaram. */
export default function ImpressoesFeitas({ linhas, totais }: ImpressoesFeitasProps) {
  return (
    <>
      <p data-jazida-bloco className="text-sm text-slate-600">
        Cada impressão em sequência vira um bloco de números. A lista continua aqui mesmo depois de restaurar a cópia da nuvem.
      </p>
      <Numeros rotulo="Resumo das impressões" className="xl:grid-cols-4" itens={[
        { rotulo: 'Números impressos', valor: totais.total },
        { rotulo: 'Viagens completas', valor: totais.completas, detalhe: 'as duas vias voltaram', tom: 'ok' },
        { rotulo: 'Liberações de volta', valor: totais.liberacoes },
        { rotulo: 'Recebimentos de volta', valor: totais.recebimentos },
      ]} />
      <div data-jazida-bloco className="flex min-h-[22rem] flex-col gap-2">
        <h2 id="jazida-impressoes-titulo" className="text-base font-bold text-slate-900">Blocos impressos</h2>
        <TabelaPadrao
          titulo="Blocos de tickets impressos"
          linhas={linhas}
          colunas={colunas}
          idDaLinha={r => r.id}
          nomeDoItem={{ um: 'bloco', varios: 'blocos' }}
          ordenacaoInicial={{ chave: 'quando', direcao: 'desc' }}
          vazio="Nenhum bloco impresso ainda."
          className="min-h-0 flex-1"
          testId="jazida-impressoes"
        />
      </div>
    </>
  );
}
