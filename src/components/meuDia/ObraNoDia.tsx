import { useMemo, type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Fuel, Truck, type LucideIcon } from 'lucide-react';
import type { Abastecimento, ControleEquipamentoDiario, Equipamento } from '../../types';
import { resumoDoDia } from '../../modules/rotina/resumoDoDia';
import { numero } from '../../utils/formato';
import { BOTAO_SECUNDARIO, CARTAO } from '../cadastros/estilos';

interface Props {
  dia: string;
  abastecimentos: readonly Abastecimento[];
  controles: readonly ControleEquipamentoDiario[];
  equipamentos: readonly Equipamento[];
  /** Abre a tela onde o dado mora. */
  onIrPara?: (aba: string) => void;
}

const MOSTRAR = 5;

function Bloco({ titulo, Icone, numeros, alerta, aba, rotuloAba, onIrPara, children }: {
  titulo: string;
  Icone: LucideIcon;
  numeros: Array<{ rotulo: string; valor: string; tom?: 'alerta' }>;
  alerta?: string;
  aba: string;
  rotuloAba: string;
  onIrPara?: (aba: string) => void;
  children: ReactNode;
}) {
  return (
    <section data-meu-dia-reveal className={`${CARTAO} flex flex-col overflow-hidden`} aria-label={titulo}>
      <header className="flex items-center gap-3 border-b border-slate-100 bg-[#f7f8f6] px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#176b4d] ring-1 ring-inset ring-slate-200"><Icone className="size-5" aria-hidden="true" /></span>
        <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
      </header>
      <dl className="grid grid-cols-3 gap-2 px-4 pt-3">
        {numeros.map(item => (
          <div key={item.rotulo} className="flex min-w-0 flex-col justify-between">
            <dt className="break-words text-xs font-semibold leading-tight text-slate-500 hyphens-auto">{item.rotulo}</dt>
            <dd className={`text-xl font-black tabular-nums ${item.tom === 'alerta' ? 'text-[#c2410c]' : 'text-slate-900'}`}>{item.valor}</dd>
          </div>
        ))}
      </dl>
      {alerta && (
        <p className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 ring-1 ring-inset ring-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#c2410c]" aria-hidden="true" />
          {alerta}
        </p>
      )}
      <div className="flex-1 px-4 py-3 text-sm text-slate-700">{children}</div>
      {onIrPara && (
        <div className="border-t border-slate-100 p-3">
          <button type="button" className={`${BOTAO_SECUNDARIO} w-full`} onClick={() => onIrPara(aba)}>
            {rotuloAba}
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}

const Vazio = ({ texto }: { texto: string }) => <p className="text-slate-500">{texto}</p>;

export function ObraNoDia({ dia, abastecimentos, controles, equipamentos, onIrPara }: Props) {
  const resumo = useMemo(
    () => resumoDoDia({ dia, abastecimentos, controles, equipamentos }),
    [dia, abastecimentos, controles, equipamentos],
  );
  const { equipamentos: eq, diesel } = resumo;
  const nomes = (lista: readonly string[]) => (lista.length > 4 ? `${lista.slice(0, 4).join(', ')} e mais ${lista.length - 4}` : lista.join(', '));

  return (
    <div className="grid items-stretch gap-3 lg:grid-cols-2">
      <Bloco
        titulo="Equipamentos"
        Icone={Truck}
        numeros={[
          { rotulo: 'Apontados', valor: String(eq.apontados) },
          { rotulo: 'Em operação', valor: String(eq.emOperacao) },
          { rotulo: 'Parados', valor: String(eq.parados.length), tom: eq.parados.length ? 'alerta' : undefined },
        ]}
        alerta={[
          eq.semMotivo ? `${eq.semMotivo} ${eq.semMotivo === 1 ? 'parado está' : 'parados estão'} sem motivo escrito` : '',
          eq.repetidos.length ? `Apontado mais de uma vez: ${nomes(eq.repetidos)}` : '',
        ].filter(Boolean).join('. ') || undefined}
        aba="controle-equipamentos"
        rotuloAba="Abrir o controle da frota"
        onIrPara={onIrPara}
      >
        {!eq.apontados && <Vazio texto="Nenhum equipamento apontado neste dia." />}
        {eq.parados.length > 0 && (
          <ul className="space-y-1">
            {eq.parados.slice(0, MOSTRAR).map(item => (
              <li key={`${item.prefixo}-${item.status}`} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span><strong className="font-bold text-slate-900">{item.prefixo}</strong> · {item.status}</span>
                <span className={item.motivo ? 'min-w-0 break-words text-slate-600' : 'font-semibold text-[#c2410c]'}>{item.motivo || 'Sem motivo'}</span>
              </li>
            ))}
          </ul>
        )}
        {eq.apontados > 0 && !eq.parados.length && <Vazio texto="Nenhum equipamento parado." />}
      </Bloco>

      <Bloco
        titulo="Diesel"
        Icone={Fuel}
        numeros={[
          { rotulo: 'Litros', valor: numero(diesel.litros, 0) },
          { rotulo: 'Abasteci\u00admentos', valor: String(diesel.abastecimentos) },
          { rotulo: 'A conferir', valor: String(diesel.aConferir), tom: diesel.aConferir ? 'alerta' : undefined },
        ]}
        aba="lancamentos"
        rotuloAba="Abrir Combustível"
        onIrPara={onIrPara}
      >
        {diesel.porEquipamento.length ? (
          <ul className="space-y-1">
            {diesel.porEquipamento.slice(0, MOSTRAR).map(item => (
              <li key={item.prefixo} className="flex items-baseline justify-between gap-3">
                <strong className="font-bold text-slate-900">{item.prefixo}</strong>
                <span className="tabular-nums">{numero(item.litros, 0)} L</span>
              </li>
            ))}
          </ul>
        ) : <Vazio texto="Nenhum abastecimento neste dia." />}
      </Bloco>
    </div>
  );
}
