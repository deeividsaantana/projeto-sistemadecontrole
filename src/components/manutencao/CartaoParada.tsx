/**
 * Cartão de um equipamento parado (ou que parou) no dia: prefixo grande,
 * situação com cor, horas do dia com barra até 10 h (ou além, quando decidem
 * seguir contando), linha do tempo do que
 * foi lançado e um botão só, o que faz sentido agora: "Liberar agora" para
 * quem está na oficina, "Entrou em manutenção" para quem já saiu.
 */
import { useState } from 'react';
import { Clock3, Timer, Wrench } from 'lucide-react';
import type { ControleEquipamentoDiario, EventoControleEquipamentoDiario } from '../../types';
import { LIMITE_HORAS_DIA, formatarMinutos, horaLocal, type ParadaDoDia } from '../../utils/horasParadasDoDia';
import { rotuloDaSituacao, type TomSituacao } from '../../utils/conferenciaManutencao';
import type { LinhaRelatorioManutencao } from '../../utils/relatorioManutencaoDia';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO } from '../cadastros/estilos';
import { TimelineManutencao, type EventoTimeline } from './TimelineManutencao';

const TOM_SELO: Record<TomSituacao, string> = {
  parado: 'bg-rose-50 text-rose-800 ring-rose-200',
  liberado: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  conferir: 'bg-amber-50 text-amber-900 ring-amber-200',
};
const TOM_BARRA: Record<TomSituacao, string> = { parado: 'bg-rose-600', liberado: 'bg-[#176b4d]', conferir: 'bg-amber-500' };

export function SeloSituacao({ parada, grupo }: { parada: ParadaDoDia; grupo?: LinhaRelatorioManutencao['grupo'] }) {
  const { texto, tom } = rotuloDaSituacao(parada.situacao, grupo);
  const iconClass = tom === 'parado' ? 'text-rose-600' : tom === 'liberado' ? 'text-emerald-700' : 'text-amber-700';
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${TOM_SELO[tom]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${iconClass}`} aria-hidden="true" />
      {texto}
    </span>
  );
}

/** Barra das horas do dia até o limite de 10 h; além dele fica cheia em âmbar. */
export function BarraDoLimite({ parada, grupo }: { parada: ParadaDoDia; grupo?: LinhaRelatorioManutencao['grupo'] }) {
  const { tom } = rotuloDaSituacao(parada.situacao, grupo);
  const limite = LIMITE_HORAS_DIA * 60;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="meter" aria-valuemin={0} aria-valuemax={Math.max(limite, parada.totalMin)} aria-valuenow={parada.totalMin}
      aria-label={parada.alemDoLimite ? `${formatarMinutos(parada.totalMin)}, sem teto` : `${formatarMinutos(parada.totalMin)} de ${LIMITE_HORAS_DIA} h`}>
      <div className={`h-full rounded-full ${parada.alemDoLimite && parada.totalMin > limite ? 'bg-amber-500' : TOM_BARRA[tom]}`} style={{ width: `${Math.min(100, (parada.totalMin / limite) * 100)}%` }} />
    </div>
  );
}

const textoDoEvento = (evento: EventoControleEquipamentoDiario) => {
  if (evento.tipo === 'ENTRADA_MANUTENCAO') return 'Entrou em manutenção';
  if (evento.tipo === 'LIBERACAO_MANUTENCAO') return 'Liberado';
  if (evento.tipo === 'SAIDA_OPERACAO') return 'Saiu para operar';
  return `Mudou para ${evento.statusNovo}`;
};

interface ItemLinhaDoTempo { id: string; hora: string; texto: string; detalhe?: string; observacao?: string; responsavel?: string; substituido?: boolean; assumiu?: boolean }

/** O que foi lançado no dia, na ordem do histórico. Lançamento antigo sem eventos usa os campos do dia. */
export const linhaDoTempo = (registro: ControleEquipamentoDiario): ItemLinhaDoTempo[] => {
  const eventos = registro.eventos || [];
  if (eventos.length === 0) {
    const itens: ItemLinhaDoTempo[] = [];
    if (registro.horaEntradaManutencao) itens.push({ id: 'entrada', hora: registro.horaEntradaManutencao, texto: 'Entrou em manutenção', detalhe: registro.motivoManutencao });
    if (registro.horaLiberacao) itens.push({ id: 'liberacao', hora: registro.horaLiberacao, texto: 'Liberado' });
    return itens;
  }
  return eventos.map(evento => ({
    id: evento.id,
    hora: evento.hora || horaLocal(evento.ocorridoEm),
    texto: textoDoEvento(evento),
    detalhe: evento.operador ? `${evento.operador} assumiu às ${evento.hora || horaLocal(evento.ocorridoEm)}` : evento.motivo || evento.observacao,
    observacao: evento.operador ? evento.observacao : undefined,
    responsavel: evento.responsavel,
    substituido: Boolean(evento.substituidoPor),
    assumiu: Boolean(evento.operador),
  }));
};

const EM_MANUTENCAO = new Set(['Em manutenção', 'Aguardando manutenção']);

interface Props {
  registro: ControleEquipamentoDiario;
  parada: ParadaDoDia;
  ordemNumero: string;
  tipo: string;
  podeEditar: boolean;
  /** Hora de agora (HH:MM), para já vir preenchida. */
  horaAgora: string;
  /** Devolve o erro para mostrar, ou nada quando salvou. */
  onLiberar: (hora: string) => string | undefined;
  onEntrar: (hora: string, motivo: string) => string | undefined;
  /** Seguir contando além de 10 h, sem fechar a OS; sem isso o botão não aparece. */
  onContinuarAlem?: () => void;
  /** Desfaz a decisão: o teto de 10 h volta. */
  onVoltarRegra?: () => void;
}

export function CartaoParada({ registro, parada, ordemNumero, tipo, podeEditar, horaAgora, onLiberar, onEntrar, onContinuarAlem, onVoltarRegra }: Props) {
  const emManutencao = EM_MANUTENCAO.has(registro.status);
  const [aberto, setAberto] = useState(false);
  const [confirmandoAlem, setConfirmandoAlem] = useState(false);
  const [hora, setHora] = useState(horaAgora);
  const [motivo, setMotivo] = useState(registro.motivoManutencao || '');
  const [erro, setErro] = useState('');
  const itens = linhaDoTempo(registro);
  const idBase = `parada-${registro.id}`;

  const abrir = () => {
    setHora(horaAgora);
    setMotivo(registro.motivoManutencao || '');
    setErro('');
    setAberto(true);
  };
  const confirmar = () => {
    const falha = emManutencao ? onLiberar(hora) : onEntrar(hora, motivo);
    if (falha) {
      setErro(falha);
      return;
    }
    setAberto(false);
  };

  return (
    <article data-manutencao-reveal data-testid="cartao-parada" aria-labelledby={`${idBase}-prefixo`} className={`${CARTAO} flex min-w-0 flex-col gap-4 p-5`}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id={`${idBase}-prefixo`} className="truncate text-3xl font-black leading-tight tracking-tight text-slate-950">{registro.prefixo}</h3>
          <p className="mt-1 break-words text-xs font-semibold text-slate-500">{[tipo, ordemNumero].filter(Boolean).join(' · ')}</p>
        </div>
        <SeloSituacao parada={parada} />
      </header>

      <div className="space-y-2.5 rounded-lg bg-slate-50 p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold text-slate-600">Parado hoje</span>
          <span className="whitespace-nowrap tabular-nums">
            <strong className="text-2xl font-black text-slate-950">{formatarMinutos(parada.totalMin)}</strong>
            <span className="text-xs font-semibold text-slate-600">{parada.alemDoLimite ? ' sem teto' : ` / ${LIMITE_HORAS_DIA} h`}</span>
          </span>
        </div>
        <BarraDoLimite parada={parada} />
        {parada.limiteAtingidoAs && !parada.alemDoLimite && <p className="text-xs font-semibold text-amber-800">Bateu 10 h às {parada.limiteAtingidoAs}. A OS fechou sozinha.</p>}
        {parada.alemDoLimite && (
          <p className="text-xs font-semibold text-amber-800" data-testid="parada-alem-aviso">
            {parada.limiteAtingidoAs ? `Passou de 10 h às ${parada.limiteAtingidoAs}. ` : ''}Segue contando até a liberação{registro.continuaAlemDoLimite?.decididoPor ? `, por decisão de ${registro.continuaAlemDoLimite.decididoPor}` : ''}.
          </p>
        )}
        {podeEditar && emManutencao && !parada.alemDoLimite && onContinuarAlem && !confirmandoAlem && (
          <button type="button" onClick={() => setConfirmandoAlem(true)} data-testid="parada-continuar-alem" className={`${BOTAO_SECUNDARIO} w-full`}>
            <Timer className="size-4" aria-hidden="true" />
            Continuar além de 10 h
          </button>
        )}
        {podeEditar && emManutencao && !parada.alemDoLimite && onContinuarAlem && confirmandoAlem && (
          <div role="group" aria-label="Confirmar continuar além de 10 h" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">Seguir contando além de 10 h? A OS não fecha sozinha e a conta só para na liberação.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmandoAlem(false)} className={BOTAO_SECUNDARIO}>Cancelar</button>
              <button type="button" onClick={() => { setConfirmandoAlem(false); onContinuarAlem(); }} data-testid="parada-continuar-alem-confirmar" className={BOTAO_PRIMARIO}>Continuar</button>
            </div>
          </div>
        )}
        {podeEditar && parada.alemDoLimite && onVoltarRegra && (
          <button type="button" onClick={onVoltarRegra} data-testid="parada-voltar-regra" className={`min-h-11 w-full rounded-lg text-xs font-semibold text-slate-600 underline-offset-4 hover:text-[#176b4d] hover:underline ${FOCO}`}>
            Voltar à regra das 10 h
          </button>
        )}
        {parada.motivoInconsistencia && <p className="text-xs font-semibold text-amber-800">{parada.motivoInconsistencia} Confira na aba Conferência.</p>}
      </div>

      {itens.length > 0 && (
        <TimelineManutencao
          eventos={itens.map((item): EventoTimeline => {
            const isPaused = item.texto.includes('Entrou') || item.texto.includes('Aguardando');
            const isLiberated = item.texto.includes('Liberado') || item.texto.startsWith('Saiu para operar');
            return {
              id: item.id,
              hora: item.hora,
              status: isLiberated ? 'liberado' : isPaused ? 'manutencao' : 'parado',
              descricao: item.texto,
              responsavel: item.responsavel,
              motivo: item.assumiu ? undefined : item.detalhe,
              assumiu: item.assumiu ? item.detalhe : undefined,
              observacao: item.observacao,
            };
          })}
          statusAtual={parada.situacao === 'LIBERADO' ? 'liberado' : emManutencao ? 'manutencao' : 'parado'}
        />
      )}

      {podeEditar && !aberto && (
        <button type="button" onClick={abrir} data-testid={emManutencao ? 'parada-liberar' : 'parada-entrar'} className={`${emManutencao ? BOTAO_PRIMARIO : BOTAO_SECUNDARIO} mt-auto w-full`}>
          {emManutencao ? <Clock3 className="size-4" aria-hidden="true" /> : <Wrench className="size-4" aria-hidden="true" />}
          {emManutencao ? 'Liberar agora' : 'Entrou em manutenção'}
        </button>
      )}

      {podeEditar && aberto && (
        <form className="mt-auto space-y-3 rounded-xl bg-gradient-to-b from-emerald-50/60 to-emerald-50/30 border border-emerald-100 p-4" onSubmit={event => { event.preventDefault(); confirmar(); }}>
          <fieldset className="space-y-3 border-0 p-0">
            <legend className="sr-only">Lançar {emManutencao ? 'liberação' : 'entrada em manutenção'}</legend>
            <label className={`${ROTULO} block`}>
              {emManutencao ? 'Hora da liberação' : 'Hora da entrada'}
              <input type="time" required value={hora} onChange={event => setHora(event.target.value)} className={`${CAMPO} mt-2`} autoFocus />
            </label>
            {!emManutencao && (
              <label className={`${ROTULO} block`}>
                Motivo
                <input value={motivo} onChange={event => setMotivo(event.target.value)} placeholder="Pneu, mangueira, elétrica..." className={`${CAMPO} mt-2`} />
              </label>
            )}
          </fieldset>
          {erro && <p role="alert" className="rounded-lg bg-rose-50 px-3.5 py-3 text-xs font-bold text-rose-700 border border-rose-200 mt-3">{erro}</p>}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-emerald-100">
            <button type="button" onClick={() => setAberto(false)} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="submit" className={BOTAO_PRIMARIO}>Confirmar</button>
          </div>
        </form>
      )}
    </article>
  );
}
