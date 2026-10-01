import { AlertTriangle } from 'lucide-react';
import type { PreviaCadastroSge } from '../../fleet/sgeApontamentos';
import { FOCO, TOM_SITUACAO } from '../cadastros/estilos';

interface Props {
  previa: PreviaCadastroSge;
  marcado: boolean;
  onMarcar: (marcado: boolean) => void;
}

const horas = (valor?: number) => valor === undefined ? '—' : `${valor.toLocaleString('pt-BR')} h`;
const dia = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Parte da prévia do SGE que mexe no cadastro dos equipamentos: quem passa a
 * ser o motorista e qual o horímetro atual. Mostra o antes e o depois de cada
 * equipamento e, separado, o que ficou para alguém decidir.
 */
export default function CadastroSgePrevia({ previa, marcado, onMarcar }: Props) {
  const total = previa.alteracoes.length;
  return (
    <section className="mt-4 rounded-xl border border-slate-200 p-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={marcado && total > 0}
          disabled={total === 0}
          onChange={event => onMarcar(event.target.checked)}
          className={`mt-0.5 size-5 shrink-0 rounded accent-emerald-700 ${FOCO}`}
        />
        <span>
          <span className="block text-sm font-bold text-slate-800">Atualizar também o cadastro dos equipamentos</span>
          <span className="block text-xs text-slate-600">
            {total === 0
              ? 'O cadastro já está igual à planilha: nenhum motorista ou horímetro para mudar.'
              : 'Cada equipamento fica com o motorista e o horímetro do último dia apontado.'}
          </span>
        </span>
      </label>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: 'Motoristas', value: previa.motoristasVinculados, tone: TOM_SITUACAO.ok },
          { label: 'Horímetros', value: previa.horimetrosAtualizados, tone: 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200' },
          { label: 'Para revisar', value: previa.revisao.length, tone: TOM_SITUACAO.alerta },
        ].map(item => (
          <div key={item.label} className={`rounded-xl p-3 ${item.tone}`}>
            <span className="text-[11px] font-bold uppercase leading-tight">{item.label}</span>
            <strong className="block text-2xl font-bold tabular-nums">{item.value}</strong>
          </div>
        ))}
      </div>

      {total > 0 && (
        <ul className="mt-3 max-h-[30vh] divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-200">
          {previa.alteracoes.map(item => (
            <li key={item.equipamentoId} className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[6rem_minmax(0,1.2fr)_minmax(0,1fr)] sm:items-center">
              <span className="font-mono font-bold text-slate-800">{item.prefixo}</span>
              <span className="min-w-0 text-slate-700">
                {item.motorista
                  ? <>{item.motorista.antes || 'Sem motorista'} → <strong>{item.motorista.depois || 'Sem motorista'}</strong></>
                  : <span className="text-slate-500">Motorista sem mudança</span>}
              </span>
              <span className="text-slate-700">
                {item.horimetro
                  ? <>{horas(item.horimetro.antes)} → <strong className="tabular-nums">{horas(item.horimetro.depois)}</strong> <span className="text-xs text-slate-500">({dia(item.horimetro.data)})</span></>
                  : <span className="text-slate-500">Horímetro sem mudança</span>}
              </span>
              {item.avisos.length > 0 && <span className="text-xs text-amber-800 sm:col-span-3">{item.avisos.join(' ')}</span>}
            </li>
          ))}
        </ul>
      )}

      {previa.revisao.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 ring-1 ring-inset ring-amber-200">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            Ficou para revisar no cadastro
          </p>
          <ul className="mt-2 max-h-[20vh] list-disc space-y-1 overflow-auto pl-5 text-xs text-amber-900">
            {previa.revisao.map(texto => <li key={texto}>{texto}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
