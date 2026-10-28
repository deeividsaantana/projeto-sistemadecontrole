/**
 * Manutenção › Conferência: os equipamentos do dia que bateram 10 h, ficaram
 * sem liberação ou têm hora que não fecha. Cada decisão fica no lançamento do
 * dia (quem decidiu e quando) e vai para o histórico com o antes e o depois.
 */
import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardCheck } from 'lucide-react';
import type { ControleEquipamentoDiario, OrdemServico } from '../../types';
import { formatarMinutos, horasParadasDoDia } from '../../utils/horasParadasDoDia';
import { confirmarDezHoras, continuaParadoAmanha, informarLiberacaoReal, vemParadoDeOntem } from '../../utils/manutencaoLimite';
import { montarRelatorioManutencaoDia, type LinhaRelatorioManutencao } from '../../utils/relatorioManutencaoDia';
import { ROTULO_DECISAO, dataDeHoje, descricaoDaConferencia } from '../../utils/conferenciaManutencao';
import { EmptyState } from '../../shared/ui';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO } from '../cadastros/estilos';
import { BarraDoLimite, SeloSituacao } from './CartaoParada';

const dataBr = (data: string) => data.split('-').reverse().join('/');
const quando = (iso: string) => new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(iso)).replace(',', ' às');

interface Props {
  registros: readonly ControleEquipamentoDiario[];
  ordens: readonly OrdemServico[];
  agora: Date;
  podeEditar: boolean;
  /** Só o administrador muda uma decisão já tomada. */
  podeReabrir: boolean;
  responsavel: string;
  /** Dias com pendência (diasParaConferir), do mais novo ao mais antigo. */
  pendentes: ReadonlyArray<{ data: string; aConferir: number }>;
  onSalvarConferencia: (registro: ControleEquipamentoDiario, descricao: string) => void;
}

export function ConferenciaManutencao({ registros, ordens, agora, podeEditar, podeReabrir, responsavel, pendentes, onSalvarConferencia }: Props) {
  const hoje = dataDeHoje(agora);
  // Abre no dia mais recente que ainda tem pendência; sem pendência, hoje.
  const [data, setData] = useState(() => pendentes[0]?.data || hoje);
  const relatorio = useMemo(() => montarRelatorioManutencaoDia(data, registros, ordens, agora), [data, registros, ordens, agora]);
  const registroPorId = useMemo(() => new Map(registros.map(registro => [registro.id, registro])), [registros]);
  // Quem já foi decidido continua na lista (com quem decidiu), mesmo depois que a liberação informada fechou o dia.
  const linhas = relatorio.linhas.filter(linha => linha.grupo !== 'OK' || registroPorId.get(linha.registroId)?.conferenciaManutencao);

  return (
    <>
      <section data-manutencao-reveal aria-label="Escolha do dia" className={`${CARTAO} flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className={`${ROTULO} block`}>
            Dia
            <input type="date" value={data} max={hoje} onChange={event => event.target.value && setData(event.target.value)} className={`${CAMPO} mt-1 block sm:w-48`} />
          </label>
          <p className="pb-2.5 text-sm font-semibold text-slate-700" aria-live="polite">
            <strong className="tabular-nums">{relatorio.conferidos} de {relatorio.equipamentos}</strong> conferidos
            {relatorio.fechado ? ' · dia fechado' : relatorio.aConferir ? ` · faltam ${relatorio.aConferir}` : ''}
          </p>
        </div>
        {pendentes.length > 0 && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-700">Dias com pendência</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {pendentes.slice(0, 8).map(dia => (
                <button key={dia.data} type="button" onClick={() => setData(dia.data)} aria-pressed={dia.data === data}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-bold transition md:min-h-10 ${FOCO} ${dia.data === data ? 'border-[#176b4d] bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-500'}`}>
                  <CalendarDays className="size-4" aria-hidden="true" />
                  {dia.data === hoje ? 'Hoje' : dataBr(dia.data).slice(0, 5)}
                  <span className="tabular-nums">· {dia.aConferir}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {linhas.length === 0
        ? <EmptyState icon={CheckCircle2} title={`Nada para conferir em ${dataBr(data)}`} description="Aqui aparecem os equipamentos que bateram 10 h paradas, ficaram sem liberação no fim do dia ou têm hora que não fecha." />
        : (
          <ul aria-label={`Conferência de ${dataBr(data)}`} className="grid gap-3 xl:grid-cols-2">
            {linhas.map(linha => {
              const registro = registroPorId.get(linha.registroId);
              return registro ? (
                <ItemConferencia key={linha.registroId} linha={linha} registro={registro} registros={registros} agora={agora}
                  podeEditar={podeEditar} podeReabrir={podeReabrir} responsavel={responsavel} onSalvar={onSalvarConferencia} />
              ) : null;
            })}
          </ul>
        )}
    </>
  );
}

interface ItemProps {
  linha: LinhaRelatorioManutencao;
  registro: ControleEquipamentoDiario;
  registros: readonly ControleEquipamentoDiario[];
  agora: Date;
  podeEditar: boolean;
  podeReabrir: boolean;
  responsavel: string;
  onSalvar: (registro: ControleEquipamentoDiario, descricao: string) => void;
}

function ItemConferencia({ linha, registro, registros, agora, podeEditar, podeReabrir, responsavel, onSalvar }: ItemProps) {
  const [reabrindo, setReabrindo] = useState(false);
  const [informando, setInformando] = useState(false);
  const [hora, setHora] = useState('');
  const [erro, setErro] = useState('');
  const { parada } = linha;
  const decisao = registro.conferenciaManutencao;
  const idBase = `conferencia-${registro.id}`;
  const mostrarAcoes = podeEditar && linha.grupo !== 'OK' && (!linha.conferido || reabrindo);

  const gravar = (novo: ControleEquipamentoDiario, horaInformada?: string) => {
    const depois = horasParadasDoDia(novo, agora, { vemParadoDeOntem: vemParadoDeOntem(registros, novo) });
    onSalvar(novo, descricaoDaConferencia({
      prefixo: registro.prefixo, data: registro.data, decisao: novo.conferenciaManutencao!.decisao,
      antes: parada, depois, anterior: decisao, hora: horaInformada,
    }));
    setReabrindo(false);
    setInformando(false);
    setErro('');
  };
  const informar = () => {
    const resultado = informarLiberacaoReal(registro, hora, responsavel, new Date().toISOString());
    if ('erro' in resultado) {
      setErro(resultado.erro);
      return;
    }
    gravar(resultado.registro, hora);
  };

  return (
    <li data-manutencao-reveal data-testid="conferencia-item" aria-labelledby={`${idBase}-prefixo`} className={`${CARTAO} flex min-w-0 flex-col gap-3 p-4`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${idBase}-prefixo`} className="truncate text-xl font-black text-slate-950">{linha.prefixo}</h3>
          <p className="truncate text-sm font-semibold text-[#5b6870]">{[linha.tipo, linha.ordemNumero].filter(Boolean).join(' · ')}</p>
        </div>
        <SeloSituacao parada={parada} grupo={linha.grupo} />
      </header>

      {parada.situacao === 'INCONSISTENTE' ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          {parada.motivoInconsistencia || 'As horas lançadas não fecham.'} Informe a hora certa da liberação.
        </p>
      ) : (
        <div>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-bold text-slate-700">Horas do dia</span>
            <strong className="text-lg font-black tabular-nums text-slate-950">{formatarMinutos(parada.totalMin)}</strong>
          </div>
          <div className="mt-1.5"><BarraDoLimite parada={parada} grupo={linha.grupo} /></div>
          <ul className="mt-2 space-y-0.5 text-sm text-slate-700" aria-label="Períodos parados">
            {parada.periodos.map((periodo, indice) => (
              <li key={indice} className="tabular-nums">
                {periodo.inicio} → {periodo.fim ?? 'sem liberação'}
                <span className="text-[#5b6870]"> · {formatarMinutos(periodo.liquidoMin)}{periodo.descontoMin ? ` (sem ${formatarMinutos(periodo.descontoMin)} de pausa)` : ''}</span>
              </li>
            ))}
          </ul>
          {parada.limiteAtingidoAs && <p className="mt-1 text-sm text-[#5b6870]">Bateu 10 h às {parada.limiteAtingidoAs}. O dia conta no máximo 10 h.</p>}
        </div>
      )}

      {decisao && (
        <p className={`rounded-xl px-3 py-2 text-sm font-semibold ${linha.conferido ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-100 text-slate-700'}`}>
          {linha.conferido ? 'Conferido' : 'Última decisão'}: {ROTULO_DECISAO[decisao.decisao]} · por {decisao.decididoPor} em {quando(decisao.decididoEm)}
        </p>
      )}

      {linha.grupo === 'OK' && decisao && (
        <p className="text-sm text-[#5b6870]">A liberação já fechou o dia. Para mudar a hora, edite o lançamento no Controle de Frotas.</p>
      )}

      {linha.grupo === 'LIMITE' && linha.conferido && podeEditar && podeReabrir && !reabrindo && (
        <button type="button" onClick={() => setReabrindo(true)} className={`${BOTAO_SECUNDARIO} self-start`}>Mudar decisão</button>
      )}

      {mostrarAcoes && !informando && (
        <div className="grid gap-2 sm:grid-cols-3">
          {linha.grupo === 'LIMITE' && (
            <button type="button" data-testid="conferencia-confirmar" onClick={() => gravar(confirmarDezHoras(registro, responsavel, new Date().toISOString()))} className={BOTAO_PRIMARIO}>
              <ClipboardCheck className="size-4" aria-hidden="true" /> Confirmar {formatarMinutos(parada.totalMin)}
            </button>
          )}
          <button type="button" data-testid="conferencia-informar" onClick={() => { setHora(''); setErro(''); setInformando(true); }} className={linha.grupo === 'LIMITE' ? BOTAO_SECUNDARIO : `${BOTAO_PRIMARIO} sm:col-span-3`}>
            Informar liberação real
          </button>
          {linha.grupo === 'LIMITE' && (
            <button type="button" data-testid="conferencia-continua" onClick={() => gravar(continuaParadoAmanha(registro, responsavel, new Date().toISOString()))} className={BOTAO_SECUNDARIO}>
              Continua parado amanhã
            </button>
          )}
          {reabrindo && <button type="button" onClick={() => setReabrindo(false)} className={`${BOTAO_SECUNDARIO} sm:col-span-3`}>Manter a decisão</button>}
        </div>
      )}

      {mostrarAcoes && informando && (
        <form className="space-y-2 rounded-xl bg-[#f7f8f6] p-3" onSubmit={event => { event.preventDefault(); informar(); }}>
          <label className={`${ROTULO} block`}>
            A que horas o {linha.prefixo} foi liberado em {dataBr(registro.data)}?
            <input type="time" required value={hora} onChange={event => setHora(event.target.value)} className={`${CAMPO} mt-1`} />
          </label>
          {erro && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{erro}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setInformando(false)} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="submit" className={BOTAO_PRIMARIO}>Gravar liberação</button>
          </div>
        </form>
      )}
    </li>
  );
}
