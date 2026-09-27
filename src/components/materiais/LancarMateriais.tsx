import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ClipboardList, Rows3, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import type { Empresa, EtapaServico, Material, MovimentoMaterial, TipoMovimentoMaterial } from '../../types';
import { numero } from '../../utils/formato';
import { CARTAO, FOCO } from '../cadastros/estilos';
import FormLancamento from './FormLancamento';
import GradeViagens from './GradeViagens';

type Aba = 'um' | 'varios';

const ABAS: ReadonlyArray<{ id: Aba; nome: string; ajuda: string; Icone: LucideIcon }> = [
  { id: 'um', nome: 'Um lançamento', ajuda: 'Uma entrega, um uso ou uma viagem', Icone: ClipboardList },
  { id: 'varios', nome: 'Várias viagens', ajuda: 'Uma linha por viagem, como na planilha', Icone: Rows3 },
];

const ICONE_TIPO: Record<TipoMovimentoMaterial, LucideIcon> = {
  Entrada: ArrowDownToLine,
  Saída: ArrowUpFromLine,
  Transferência: ArrowLeftRight,
  Ajuste: SlidersHorizontal,
};
const NOME_TIPO: Record<TipoMovimentoMaterial, string> = { Entrada: 'Chegou', Saída: 'Saiu', Transferência: 'Transporte', Ajuste: 'Ajuste' };
const CONTAGEM_TIPO: Record<TipoMovimentoMaterial, [string, string]> = {
  Entrada: ['entrada', 'entradas'],
  Saída: ['saída', 'saídas'],
  Transferência: ['transporte', 'transportes'],
  Ajuste: ['ajuste', 'ajustes'],
};

interface Props {
  hoje: string;
  materiais: readonly Material[];
  movimentos: MovimentoMaterial[];
  empresas: readonly Empresa[];
  etapas: readonly EtapaServico[];
  responsavel: string;
  onSalvar: (movimento: MovimentoMaterial, novo: boolean) => void;
  onSalvarVarios: (movimentos: MovimentoMaterial[], descricao: string) => void;
  onEditar: (movimento: MovimentoMaterial) => void;
  onVerMovimentos: () => void;
}

/**
 * Lançar na tela toda, sem janela por cima: uma aba para um lançamento de cada
 * vez e outra para várias viagens em grade. Ao lado, o que já foi lançado hoje,
 * para conferir na hora e corrigir com um toque.
 */
export default function LancarMateriais({ hoje, materiais, movimentos, empresas, etapas, responsavel, onSalvar, onSalvarVarios, onEditar, onVerMovimentos }: Props) {
  const [aba, setAba] = useState<Aba>('um');

  const deHoje = useMemo(() => movimentos
    .filter(item => item.data === hoje && !item.canceladoEm)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)), [hoje, movimentos]);
  const porTipo = useMemo(() => {
    const contagem: Partial<Record<TipoMovimentoMaterial, number>> = {};
    deHoje.forEach(item => { contagem[item.tipo] = (contagem[item.tipo] || 0) + 1; });
    return contagem;
  }, [deHoje]);

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Como lançar" data-materiais-reveal className="grid grid-cols-2 gap-2">
        {ABAS.map(({ id, nome, ajuda, Icone }) => {
          const ativa = aba === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ativa}
              data-testid={`lancar-aba-${id}`}
              onClick={() => setAba(id)}
              className={`flex min-h-14 items-center gap-2 rounded-2xl border px-3 py-3 sm:min-h-16 sm:gap-3 sm:px-4 text-left transition duration-200 ${FOCO} ${ativa
                ? 'border-[#176b4d] bg-[#176b4d] text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'}`}
            >
              <Icone className="size-5 shrink-0 sm:size-6" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-base font-bold">{nome}</span>
                <span className={`hidden text-sm sm:block ${ativa ? 'text-white/80' : 'text-slate-500'}`}>{ajuda}</span>
              </span>
            </button>
          );
        })}
      </div>

      {aba === 'um' ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <FormLancamento
            modo="pagina"
            aberto
            editando={null}
            hoje={hoje}
            materiais={materiais}
            movimentos={movimentos}
            empresas={empresas}
            etapas={etapas}
            responsavel={responsavel}
            onSalvar={onSalvar}
            onFechar={() => undefined}
          />

          <aside data-materiais-reveal aria-labelledby="lancados-hoje" className={`${CARTAO} flex flex-col self-start overflow-hidden xl:sticky xl:top-4`}>
            <header className="border-b border-slate-100 px-4 py-3">
              <h2 id="lancados-hoje" className="text-base font-bold text-slate-900">Lançados hoje</h2>
              <p className="text-sm text-slate-500">
                {deHoje.length
                  ? (Object.entries(porTipo) as Array<[TipoMovimentoMaterial, number]>).map(([tipo, quantos]) => `${quantos} ${CONTAGEM_TIPO[tipo][quantos === 1 ? 0 : 1]}`).join(' · ')
                  : 'Nada lançado hoje ainda.'}
              </p>
            </header>
            {deHoje.length > 0 && (
              <ol className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto" aria-live="polite">
                {deHoje.slice(0, 30).map(item => {
                  const Icone = ICONE_TIPO[item.tipo];
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onEditar(item)}
                        className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition duration-200 hover:bg-slate-50 ${FOCO}`}
                        title="Tocar para corrigir"
                      >
                        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${item.tipo === 'Entrada' ? 'bg-emerald-50 text-[#176b4d]' : item.tipo === 'Saída' ? 'bg-orange-50 text-[#f26a2e]' : 'bg-slate-100 text-slate-600'}`}>
                          <Icone className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm text-slate-900">{item.materialDescricao}</strong>
                          <span className="block truncate text-xs text-slate-500">{[NOME_TIPO[item.tipo], item.destino, item.placa].filter(Boolean).join(' · ')}</span>
                        </span>
                        <strong className="shrink-0 text-sm tabular-nums text-slate-900">{numero(Math.abs(item.quantidade))} {item.unidade}</strong>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="mt-auto border-t border-slate-100 p-3">
              <button type="button" onClick={onVerMovimentos} className={`min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:border-emerald-500 hover:text-[#176b4d] ${FOCO}`}>
                Ver todos os movimentos
              </button>
            </div>
          </aside>
        </div>
      ) : (
        <GradeViagens
          modo="pagina"
          aberto
          hoje={hoje}
          materiais={materiais}
          movimentos={movimentos}
          empresas={empresas}
          responsavel={responsavel}
          onSalvar={onSalvarVarios}
          onFechar={() => undefined}
        />
      )}
    </div>
  );
}
