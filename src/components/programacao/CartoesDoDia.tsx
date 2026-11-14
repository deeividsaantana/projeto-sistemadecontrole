import { useState } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { ehDomingo, somarDias, trabalhaNoDia, type ResumoAtividade } from '../../utils/programacao';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from '../cadastros/estilos';
import { BarraAvanco, COR_SITUACAO, SeloSituacao, diaDaSemana, diaMes, numeroObra } from './visual';

interface Props {
  resumos: readonly ResumoAtividade[];
  dia: string;
  hoje: string;
  podeEditar: boolean;
  onTrocarDia: (dia: string) => void;
  onAbrir: (resumo: ResumoAtividade) => void;
  onLancar: (resumo: ResumoAtividade, quantidade: number) => void;
  onCopiarDia: () => void;
}

/**
 * O que cada equipe faz no dia, em cartões grandes: frente, serviço, meta do
 * dia e o campo para lançar o que foi feito. É a tela do encarregado no
 * celular.
 */
export function CartoesDoDia({ resumos, dia, hoje, podeEditar, onTrocarDia, onAbrir, onLancar, onCopiarDia }: Props) {
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const doDia = resumos.filter(resumo => resumo.situacao !== 'cancelada' && trabalhaNoDia(resumo.item, dia));
  const rotuloDia = dia === hoje ? 'Hoje' : dia === somarDias(hoje, 1) ? 'Amanhã' : dia === somarDias(hoje, -1) ? 'Ontem' : diaDaSemana(dia);

  const lancar = (resumo: ResumoAtividade) => {
    const valor = Number(String(quantidades[resumo.item.id] ?? '').replace(',', '.'));
    if (!(valor > 0)) return;
    onLancar(resumo, valor);
    setQuantidades(atual => ({ ...atual, [resumo.item.id]: '' }));
  };

  return (
    <section aria-label="Serviços do dia" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onTrocarDia(somarDias(dia, -1))} className={`${BOTAO_SECUNDARIO} !px-2.5`} aria-label="Dia anterior">
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <p className="min-w-36 text-center leading-tight">
            <span className="block text-xs font-bold uppercase text-[#5b6870]">{rotuloDia}</span>
            <strong className="block text-lg font-black tabular-nums text-slate-900">{diaDaSemana(dia)}, {diaMes(dia)}</strong>
          </p>
          <button type="button" onClick={() => onTrocarDia(somarDias(dia, 1))} className={`${BOTAO_SECUNDARIO} !px-2.5`} aria-label="Próximo dia">
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
          {dia !== hoje && <button type="button" onClick={() => onTrocarDia(hoje)} className={BOTAO_SECUNDARIO}>Hoje</button>}
        </div>
        <button type="button" onClick={onCopiarDia} className={BOTAO_SECUNDARIO} disabled={!doDia.length}>
          <MessageCircle className="size-4" aria-hidden="true" />
          Copiar para o WhatsApp
        </button>
      </div>

      {doDia.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-[#5b6870]">
          {ehDomingo(dia) ? 'Domingo não tem serviço programado.' : 'Nenhum serviço programado para este dia com os filtros escolhidos.'}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {doDia.map(resumo => {
            const { item } = resumo;
            const idCampo = `prod-${item.id}`;
            return (
              <li key={item.id} data-linha-lista className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <span className={`h-1.5 ${COR_SITUACAO[resumo.situacao].ponto}`} aria-hidden="true" />
                <button type="button" onClick={() => onAbrir(resumo)} className="flex flex-1 flex-col gap-3 p-4 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--renea-focus)">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-xs font-bold uppercase text-[#5b6870]">{item.frente || 'Sem frente'}</span>
                      <span className="block text-lg font-black leading-tight text-slate-900">{item.servicoDescricao}</span>
                      <span className="block text-sm font-semibold text-slate-600">{item.responsavel || item.equipeNome || 'Sem responsável'}</span>
                    </span>
                    <SeloSituacao situacao={resumo.situacao} />
                  </span>
                  <span className="flex flex-wrap items-end gap-x-5 gap-y-1">
                    <span>
                      <span className="block text-xs font-bold uppercase text-[#5b6870]">Meta do dia</span>
                      <strong className="text-2xl font-black tabular-nums text-slate-900">{numeroObra(resumo.meta)}</strong>
                      <span className="ml-1 text-sm font-bold text-[#5b6870]">{item.unidade}</span>
                    </span>
                    {item.estacaInicial && (
                      <span className="text-sm font-semibold text-slate-700">
                        Estaca {item.estacaInicial}{item.estacaFinal ? ` a ${item.estacaFinal}` : ''}
                      </span>
                    )}
                  </span>
                  <span className="block">
                    <span className="mb-1 flex justify-between text-xs font-semibold text-[#5b6870]">
                      <span>Feito {numeroObra(resumo.realizado)} de {numeroObra(item.quantidadePlanejada)} {item.unidade}</span>
                      <span>até {diaMes(item.dataFim)}</span>
                    </span>
                    <BarraAvanco percentual={resumo.percentual} situacao={resumo.situacao} />
                  </span>
                </button>
                {podeEditar && dia <= hoje && (
                  <form
                    className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-[#f7f8f6] px-4 py-3"
                    onSubmit={event => { event.preventDefault(); lancar(resumo); }}
                  >
                    <label htmlFor={idCampo} className="w-full text-xs font-bold uppercase text-[#5b6870]">
                      Produção de {dia === hoje ? 'hoje' : diaMes(dia)}
                      {resumo.lancadoNoDia > 0 && <span className="ml-1 normal-case text-[#176b4d]">· já lançado {numeroObra(resumo.lancadoNoDia)} {item.unidade}</span>}
                    </label>
                    <input
                      id={idCampo}
                      inputMode="decimal"
                      value={quantidades[item.id] ?? ''}
                      onChange={event => setQuantidades(atual => ({ ...atual, [item.id]: event.target.value }))}
                      placeholder={`Quantos ${item.unidade}?`}
                      className={`${CAMPO} min-w-0 flex-1 !text-lg font-bold tabular-nums`}
                    />
                    <button type="submit" className={BOTAO_PRIMARIO} disabled={!(Number(String(quantidades[item.id] ?? '').replace(',', '.')) > 0)}>Lançar</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
