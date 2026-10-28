/**
 * Cartão de um equipamento parado (ou que parou) no dia: prefixo grande,
 * situação com cor, horas do dia com barra até 10 h, linha do tempo do que
 * foi lançado e um botão só, o que faz sentido agora: "Liberar agora" para
 * quem está na oficina, "Entrou em manutenção" para quem já saiu.
 */
import { useState } from 'react';
import { Clock3, Wrench } from 'lucide-react';
import type { ControleEquipamentoDiario, EventoControleEquipamentoDiario } from '../../types';
import { LIMITE_HORAS_DIA, formatarMinutos, horaLocal, type ParadaDoDia } from '../../utils/horasParadasDoDia';
import { rotuloDaSituacao, type TomSituacao } from '../../utils/conferenciaManutencao';
import type { LinhaRelatorioManutencao } from '../../utils/relatorioManutencaoDia';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, ROTULO } from '../cadastros/estilos';

const TOM_SELO: Record<TomSituacao, string> = {
  parado: 'bg-rose-50 text-rose-800 ring-rose-200',
  liberado: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  conferir: 'bg-amber-50 text-amber-900 ring-amber-200',
};
const TOM_BARRA: Record<TomSituacao, string> = { parado: 'bg-rose-600', liberado: 'bg-[#176b4d]', conferir: 'bg-amber-500' };

export function SeloSituacao({ parada, grupo }: { parada: ParadaDoDia; grupo?: LinhaRelatorioManutencao['grupo'] }) {
  const { texto, tom } = rotuloDaSituacao(parada.situacao, grupo);
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${TOM_SELO[tom]}`}>{texto}</span>;
}

/** Barra das horas do dia até o limite de 10 h. */
export function BarraDoLimite({ parada, grupo }: { parada: ParadaDoDia; grupo?: LinhaRelatorioManutencao['grupo'] }) {
  const { tom } = rotuloDaSituacao(parada.situacao, grupo);
  const limite = LIMITE_HORAS_DIA * 60;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="meter" aria-valuemin={0} aria-valuemax={limite} aria-valuenow={parada.totalMin}
      aria-label={`${formatarMinutos(parada.totalMin)} de ${LIMITE_HORAS_DIA} h`}>
      <div className={`h-full rounded-full ${TOM_BARRA[tom]}`} style={{ width: `${Math.min(100, (parada.totalMin / limite) * 100)}%` }} />
    </div>
  );
}

const textoDoEvento = (evento: EventoControleEquipamentoDiario) => {
  if (evento.tipo === 'ENTRADA_MANUTENCAO') return 'Entrou em manutenção';
  if (evento.tipo === 'LIBERACAO_MANUTENCAO') return 'Liberado';
  if (evento.tipo === 'SAIDA_OPERACAO') return 'Saiu para operar';
  return `Mudou para ${evento.statusNovo}`;
};

interface ItemLinhaDoTempo { id: string; hora: string; texto: string; detalhe?: string; responsavel?: string }

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
    detalhe: evento.motivo || evento.observacao,
    responsavel: evento.responsavel,
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
}

export function CartaoParada({ registro, parada, ordemNumero, tipo, podeEditar, horaAgora, onLiberar, onEntrar }: Props) {
  const emManutencao = EM_MANUTENCAO.has(registro.status);
  const [aberto, setAberto] = useState(false);
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
    <article data-manutencao-reveal data-testid="cartao-parada" aria-labelledby={`${idBase}-prefixo`} className={`${CARTAO} flex min-w-0 flex-col gap-3 p-4`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${idBase}-prefixo`} className="truncate text-2xl font-black leading-tight tracking-tight text-slate-950">{registro.prefixo}</h3>
          <p className="truncate text-sm font-semibold text-[#5b6870]">{[tipo, ordemNumero].filter(Boolean).join(' · ')}</p>
        </div>
        <SeloSituacao parada={parada} />
      </header>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-bold text-slate-700">Parado hoje</span>
          <span className="tabular-nums">
            <strong className="text-xl font-black text-slate-950">{formatarMinutos(parada.totalMin)}</strong>
            <span className="text-sm font-semibold text-[#5b6870]"> de {LIMITE_HORAS_DIA} h</span>
          </span>
        </div>
        <div className="mt-1.5"><BarraDoLimite parada={parada} /></div>
        {parada.limiteAtingidoAs && <p className="mt-1.5 text-sm font-semibold text-amber-900">Bateu 10 h às {parada.limiteAtingidoAs}. A OS fechou sozinha.</p>}
        {parada.motivoInconsistencia && <p className="mt-1.5 text-sm font-semibold text-amber-900">{parada.motivoInconsistencia} Confira na aba Conferência.</p>}
      </div>

      {itens.length > 0 && (
        <ol aria-label={`Linha do tempo de ${registro.prefixo}`} className="relative space-y-2.5 border-l-2 border-slate-200 pl-4">
          {itens.map(item => (
            <li key={item.id} className="relative">
              <span className="absolute -left-[1.4rem] top-1 size-3 rounded-full border-2 border-white bg-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-800"><strong className="tabular-nums">{item.hora}</strong> · {item.texto}</p>
              {(item.detalhe || item.responsavel) && (
                <p className="text-xs text-[#5b6870]">{[item.detalhe, item.responsavel && `por ${item.responsavel}`].filter(Boolean).join(' · ')}</p>
              )}
            </li>
          ))}
        </ol>
      )}

      {podeEditar && !aberto && (
        <button type="button" onClick={abrir} data-testid={emManutencao ? 'parada-liberar' : 'parada-entrar'} className={`${emManutencao ? BOTAO_PRIMARIO : BOTAO_SECUNDARIO} mt-auto w-full`}>
          {emManutencao ? <Clock3 className="size-4" aria-hidden="true" /> : <Wrench className="size-4" aria-hidden="true" />}
          {emManutencao ? 'Liberar agora' : 'Entrou em manutenção'}
        </button>
      )}

      {podeEditar && aberto && (
        <form className="mt-auto space-y-2 rounded-xl bg-[#f7f8f6] p-3" onSubmit={event => { event.preventDefault(); confirmar(); }}>
          <label className={`${ROTULO} block`}>
            {emManutencao ? 'Hora da liberação' : 'Hora da entrada'}
            <input type="time" required value={hora} onChange={event => setHora(event.target.value)} className={`${CAMPO} mt-1`} />
          </label>
          {!emManutencao && (
            <label className={`${ROTULO} block`}>
              Motivo
              <input value={motivo} onChange={event => setMotivo(event.target.value)} placeholder="Pneu, mangueira, elétrica..." className={`${CAMPO} mt-1`} />
            </label>
          )}
          {erro && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{erro}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setAberto(false)} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="submit" className={BOTAO_PRIMARIO}>Confirmar</button>
          </div>
        </form>
      )}
    </article>
  );
}
