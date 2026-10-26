import { useMemo } from 'react';
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';
import { cn } from '../../shared/ui/styles';
import { formatTravelDuration, type TravelOperation, type TravelOperationControl, type TravelPairStatus } from '../../utils/travelOperations';
import { Numeros } from './Numeros';

/** O que cada situação quer dizer, nas palavras de quem está na obra. */
export const SITUACAO_DA_VIAGEM: Record<TravelPairStatus, string> = {
  Conferido: 'Certa',
  Divergência: 'Dados diferentes',
  'Sem recebimento': 'Falta a chegada',
  'Sem liberação': 'Falta a saída',
  'Ticket duplicado': 'Número repetido',
};

const PRIORIDADE: TravelPairStatus[] = ['Ticket duplicado', 'Divergência', 'Sem recebimento', 'Sem liberação'];

/** Viagens que ainda não batem, a mais grave primeiro (mesma ordem de antes). */
export const viagensParaConferir = (control: TravelOperationControl) => control.operations
  .filter(operation => operation.status !== 'Conferido')
  .sort((left, right) => PRIORIDADE.indexOf(left.status) - PRIORIDADE.indexOf(right.status)
    || right.ticketNumber.localeCompare(left.ticketNumber, 'pt-BR', { numeric: true }));

const quando = (valor?: string) => valor ? valor.replace('T', ' ').slice(0, 16).split(' ').map((parte, i) => i === 0 ? parte.split('-').reverse().join('/') : parte).join(' ') : 'sem registro';

/**
 * Viagens a conferir: junta a via de saída (liberação) e a de chegada
 * (recebimento) pelo número do ticket e mostra as que não batem: falta uma
 * das vias, o número se repete ou caminhão, placa, material ou quantidade
 * estão diferentes nas duas.
 */
export default function ViagensAConferir({ travelControl }: { travelControl: TravelOperationControl }) {
  const linhas = useMemo(() => viagensParaConferir(travelControl), [travelControl]);

  const colunas: ColunaTabela<TravelOperation>[] = [
    { chave: 'ticket', titulo: 'Ticket', render: op => <b className="tabular-nums text-slate-900">{op.ticketNumber}</b>, valorOrdenacao: op => Number(op.ticketNumber) || op.ticketNumber, larguraMinima: 90 },
    {
      chave: 'situacao', titulo: 'Situação', larguraMinima: 150,
      render: op => (
        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-sm font-semibold ring-1 ring-inset',
          op.status === 'Divergência' || op.status === 'Ticket duplicado' ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-amber-50 text-amber-900 ring-amber-200')}>
          {SITUACAO_DA_VIAGEM[op.status]}
        </span>
      ),
      dica: op => SITUACAO_DA_VIAGEM[op.status],
      valorOrdenacao: op => PRIORIDADE.indexOf(op.status),
    },
    { chave: 'saida', titulo: 'Saída da jazida', render: op => `${op.release?.prefixo || '—'} · ${quando(op.releaseEvent?.ocorridoEm)}` },
    { chave: 'chegada', titulo: 'Chegada na obra', render: op => `${op.receipt?.prefixo || '—'} · ${quando(op.receiptEvent?.ocorridoEm)}` },
    { chave: 'duracao', titulo: 'Tempo de viagem', alinhamento: 'direita', render: op => formatTravelDuration(op.durationMinutes), valorOrdenacao: op => op.durationMinutes },
    {
      chave: 'conferir', titulo: 'O que conferir', larguraMinima: 200,
      render: op => op.divergences.map(item => item.label).join(', ')
        || (op.status === 'Ticket duplicado' ? `${op.releases.length} saída(s) e ${op.receipts.length} chegada(s) com o mesmo número`
          : op.status === 'Sem recebimento' ? 'A via da obra ainda não foi lançada'
            : 'A via da jazida ainda não foi lançada'),
    },
  ];

  return (
    <>
      <p data-jazida-bloco className="text-sm text-slate-600">
        As duas vias de cada viagem são juntadas pelo número do ticket. Aqui ficam as que <b className="text-slate-800">ainda não batem</b>: falta uma das vias, o número se repete ou caminhão, placa, material ou quantidade estão diferentes.
      </p>
      <Numeros rotulo="Resumo das viagens" itens={[
        { rotulo: 'Números de ticket', valor: travelControl.totalTickets, detalhe: 'todas as viagens' },
        { rotulo: 'Viagens certas', valor: travelControl.completeTrips, detalhe: 'as duas vias batem', tom: 'ok' },
        { rotulo: 'Dados diferentes', valor: travelControl.divergentTrips, detalhe: 'saída e chegada não batem', tom: travelControl.divergentTrips ? 'perigo' : 'ok' },
        { rotulo: 'Falta a chegada', valor: travelControl.releasesWithoutReceipt, detalhe: 'só a via da jazida', tom: travelControl.releasesWithoutReceipt ? 'alerta' : 'ok' },
        { rotulo: 'Falta a saída', valor: travelControl.receiptsWithoutRelease, detalhe: 'só a via da obra', tom: travelControl.receiptsWithoutRelease ? 'alerta' : 'ok' },
        { rotulo: 'Tempo médio', valor: formatTravelDuration(travelControl.averageDurationMinutes), detalhe: `${travelControl.duplicateTickets} número(s) repetido(s)` },
      ]} />
      <p data-jazida-bloco className="text-sm text-slate-600">
        Achados no cadastro: {travelControl.linkedEquipment} caminhão(ões), {travelControl.linkedMaterials} material(is), {travelControl.linkedDestinations} local(is) e {travelControl.linkedBranches} ramo(s).
      </p>
      <div data-jazida-bloco className="flex min-h-[22rem] flex-col gap-2">
        <h2 id="jazida-conferir-titulo" className="text-base font-bold text-slate-900">Viagens que não batem</h2>
        <TabelaPadrao
          titulo="Viagens que não batem"
          linhas={linhas}
          colunas={colunas}
          idDaLinha={op => op.ticketNumber}
          nomeDoItem={{ um: 'viagem', varios: 'viagens' }}
          vazio="Tudo certo: todas as viagens têm as duas vias e os dados batem."
          className="min-h-0 flex-1"
          testId="jazida-a-conferir"
        />
      </div>
    </>
  );
}
