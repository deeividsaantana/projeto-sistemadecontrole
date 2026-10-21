/**
 * Trocar a data de vários abastecimentos de uma vez: a pessoa marca na lista,
 * escolhe o dia certo e vê antes de confirmar quantos são, de quantos dias
 * saem e se algum vai ficar repetido no dia novo.
 */
import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2 } from 'lucide-react';
import type { Abastecimento } from '../../types';
import { Modal, isoDay } from '../../shared/ui';
import { repetidosAoTrocar } from '../../modules/frota/repetidosDiesel';
import { getFuelRecordCompetence } from '../../modules/frota/fuelReport';
import { nomeDoMes } from '../../modules/frota/planilhaDiesel';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from '../cadastros/estilos';

interface Props {
  aberto: boolean;
  itens: readonly Abastecimento[];
  todos: readonly Abastecimento[];
  onConfirmar: (novaData: string) => void;
  onFechar: () => void;
}

const dataCurta = (dia: string) => (dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR') : '');
const litrosTexto = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`;

export default function TrocarDataLote({ aberto, itens, todos, onConfirmar, onFechar }: Props) {
  const campoRef = useRef<HTMLInputElement>(null);
  const [novaData, setNovaData] = useState(() => isoDay(new Date()));
  const dias = useMemo(() => [...new Set(itens.map(item => item.data))].sort(), [itens]);
  const litros = itens.reduce((soma, item) => soma + Number(item.quantidadeLitros || 0), 0);
  const repetidos = useMemo(() => (novaData ? repetidosAoTrocar(todos, itens, novaData) : 0), [itens, novaData, todos]);
  const jaNaData = itens.filter(item => item.data === novaData).length;
  const mesmoMes = dias.every(dia => getFuelRecordCompetence({ data: dia }) === getFuelRecordCompetence({ data: novaData }));
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(novaData) && novaData <= isoDay(new Date()) && jaNaData < itens.length;

  const confirmar = () => { if (valida) onConfirmar(novaData); };

  return (
    <Modal
      open={aberto}
      size="sm"
      title={`Trocar a data de ${itens.length} abastecimento${itens.length === 1 ? '' : 's'}`}
      description={`Somam ${litrosTexto(litros)}. Hoje ${dias.length === 1 ? `estão em ${dataCurta(dias[0])}` : `estão em ${dias.length} dias, de ${dataCurta(dias[0])} a ${dataCurta(dias[dias.length - 1])}`}.`}
      onClose={onFechar}
      onSubmit={confirmar}
      initialFocusRef={campoRef}
      footer={<>
        <button type="button" onClick={onFechar} className={BOTAO_SECUNDARIO}>Cancelar</button>
        <button type="button" onClick={confirmar} disabled={!valida} className={BOTAO_PRIMARIO} data-testid="trocar-data-confirmar">
          <CheckCircle2 className="size-4" aria-hidden="true" />Levar para {dataCurta(novaData) || '…'}
        </button>
      </>}
    >
      <label className="block" htmlFor="trocar-data-dia">
        <span className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-700"><CalendarDays className="size-4 text-[#176b4d]" aria-hidden="true" />Nova data</span>
        <input ref={campoRef} id="trocar-data-dia" type="date" value={novaData} max={isoDay(new Date())} onChange={event => setNovaData(event.target.value)} className={`${CAMPO} text-lg font-bold`} data-testid="trocar-data-campo" />
      </label>
      <ul className="mt-3 space-y-2 text-sm font-semibold">
        <li className="rounded-xl bg-[#f7f8f6] px-3 py-2 text-slate-700 ring-1 ring-inset ring-slate-200">
          Hora, máquina, litros e bombas ficam como estão. Muda só o dia{mesmoMes ? '.' : `, e eles passam para a aba ${nomeDoMes(getFuelRecordCompetence({ data: novaData }))}.`}
        </li>
        {repetidos > 0 && (
          <li className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-900 ring-1 ring-inset ring-amber-200" data-testid="trocar-data-repetidos">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {repetidos} vão ficar iguais a outro lançamento em {dataCurta(novaData)} (mesma máquina e mesmos litros). Confira depois na lista de repetidos.
          </li>
        )}
        {jaNaData > 0 && jaNaData < itens.length && <li className="px-1 text-slate-500">{jaNaData} já estão nesse dia e não mudam.</li>}
        {jaNaData === itens.length && <li className="px-1 text-slate-500">Todos já estão nesse dia.</li>}
      </ul>
    </Modal>
  );
}
