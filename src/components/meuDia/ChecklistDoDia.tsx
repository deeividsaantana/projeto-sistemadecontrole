import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, CheckCheck, ChevronDown, Plus, RotateCcw, Save, Settings2, Trash2, X } from 'lucide-react';
import type { BlocoRotina, MomentoRotina, RotinaDiaria } from '../../types';
import { MOMENTOS, alternarBloco, alternarItem, copiarPadrao, moverBloco, moverItem, novoBloco, novoItem, progresso, tirarBloco, trocarBloco } from '../../modules/rotina/checklistDiario';
import { ConfirmDialog, EmptyState } from '../../shared/ui';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO } from '../cadastros/estilos';

interface Props {
  rotina: RotinaDiaria;
  blocos: readonly BlocoRotina[];
  /** Só os blocos deste momento (a parte Fechamento mostra só o fim do dia). */
  somente?: MomentoRotina;
  proprio: boolean;
  onMudarRotina: (rotina: RotinaDiaria) => void;
  onSalvarBlocos?: (blocos: BlocoRotina[], descricao: string) => void;
}

function BarraProgresso({ feitos, total }: { feitos: number; total: number }) {
  const percentual = total ? Math.round((feitos / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
      <div className={`h-full rounded-full transition-[width] duration-500 ${percentual === 100 ? 'bg-[#176b4d]' : 'bg-[#f26a2e]'}`} style={{ width: `${percentual}%` }} />
    </div>
  );
}

/** Marcar o dia: blocos que abrem e fecham, cada item um toque. */
function Marcar({ rotina, blocos, somente, onMudarRotina }: Pick<Props, 'rotina' | 'blocos' | 'somente' | 'onMudarRotina'>) {
  const conta = useMemo(() => progresso(rotina, blocos), [rotina, blocos]);
  const feitos = new Set(rotina.feitos);
  const [abertos, setAbertos] = useState<Set<string>>(() => {
    // Abre o primeiro bloco que ainda falta, para a pessoa já ver onde parou.
    const falta = blocos.find(bloco => (!somente || bloco.momento === somente) && bloco.itens.some(item => !rotina.feitos.includes(item.id)));
    return new Set(somente ? blocos.filter(bloco => bloco.momento === somente).map(bloco => bloco.id) : falta ? [falta.id] : []);
  });
  const alternarAberto = (id: string) => setAbertos(atual => {
    const novo = new Set(atual);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    return novo;
  });
  const momentos = MOMENTOS.filter(momento => (!somente || momento.id === somente) && blocos.some(bloco => bloco.momento === momento.id));

  if (!momentos.length) {
    return <EmptyState compact icon={CheckCheck} title="Nenhum bloco aqui" description="Toque em Montar meu checklist para criar os seus blocos." />;
  }

  return (
    <div className="space-y-5">
      {momentos.map(momento => (
        <section key={momento.id} aria-labelledby={`momento-${momento.id}`} className="space-y-2">
          {!somente && (
            <div className="flex items-baseline gap-2 px-1">
              <h3 id={`momento-${momento.id}`} className="text-sm font-bold uppercase tracking-wide text-[#718087]">{momento.nome}</h3>
              <span className="text-sm text-slate-500">{momento.ajuda}</span>
            </div>
          )}
          <div className={`grid items-start gap-3 ${somente ? '' : 'lg:grid-cols-2'}`}>
            {blocos.filter(bloco => bloco.momento === momento.id).map(bloco => {
              const parcial = conta.porBloco[bloco.id] || { feitos: 0, total: 0 };
              const completo = parcial.total > 0 && parcial.feitos === parcial.total;
              const aberto = abertos.has(bloco.id);
              return (
                <article key={bloco.id} data-meu-dia-reveal className={`${CARTAO} overflow-hidden transition-colors duration-200 hover:border-emerald-300 ${completo ? 'border-emerald-200' : ''}`}>
                  <button type="button" onClick={() => alternarAberto(bloco.id)} aria-expanded={aberto} className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left ${FOCO}`}>
                    <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${completo ? 'bg-[#176b4d] text-white' : 'bg-[#f7f8f6] text-slate-700 ring-1 ring-inset ring-slate-200'}`}>
                      {completo ? <Check className="size-5" aria-hidden="true" /> : `${parcial.feitos}/${parcial.total}`}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-slate-900">{bloco.titulo}</span>
                      {bloco.ajuda && <span className="block text-sm text-slate-600">{bloco.ajuda}</span>}
                      <span className="mt-1.5 block"><BarraProgresso feitos={parcial.feitos} total={parcial.total} /></span>
                    </span>
                    <ChevronDown className={`size-5 shrink-0 text-slate-500 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  {aberto && (
                    <div className="border-t border-slate-100 px-2 pb-2 pt-1">
                      {bloco.itens.length === 0 && <p className="px-2 py-3 text-sm text-slate-500">Bloco sem itens. Acrescente em Montar meu checklist.</p>}
                      <ul>
                        {bloco.itens.map(item => {
                          const marcado = feitos.has(item.id);
                          return (
                            <li key={item.id}>
                              <label className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-2 py-2.5 transition-colors duration-150 hover:bg-[#f7f8f6] ${marcado ? 'text-slate-500' : 'text-slate-800'}`}>
                                <input
                                  type="checkbox"
                                  className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-[#176b4d]"
                                  checked={marcado}
                                  onChange={() => onMudarRotina(alternarItem(rotina, item.id))}
                                />
                                <span className={`text-sm leading-snug ${marcado ? 'line-through decoration-slate-300' : ''}`}>{item.texto}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                      {bloco.itens.length > 1 && (
                        <button type="button" onClick={() => onMudarRotina(alternarBloco(rotina, bloco))} className={`mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-[#176b4d] ${FOCO}`}>
                          <CheckCheck className="size-4" aria-hidden="true" />
                          {completo ? 'Desmarcar o bloco' : 'Marcar o bloco todo'}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Montar o checklist do próprio jeito: criar, renomear, mover e apagar blocos e itens. */
function Montar({ blocos, proprio, onSalvar, onFechar }: { blocos: readonly BlocoRotina[]; proprio: boolean; onSalvar: (blocos: BlocoRotina[], descricao: string) => void; onFechar: () => void }) {
  const [rascunho, setRascunho] = useState<BlocoRotina[]>(() => blocos.map(bloco => ({ ...bloco, itens: [...bloco.itens] })));
  const [novosItens, setNovosItens] = useState<Record<string, string>>({});
  const [tituloNovo, setTituloNovo] = useState('');
  const [momentoNovo, setMomentoNovo] = useState<MomentoRotina>('durante');
  const [apagarBloco, setApagarBloco] = useState<BlocoRotina | null>(null);
  const [voltarPadrao, setVoltarPadrao] = useState(false);
  const mudou = JSON.stringify(rascunho) !== JSON.stringify(blocos);

  const mudarBloco = (bloco: BlocoRotina) => setRascunho(atual => trocarBloco(atual, bloco));
  const acrescentarItem = (bloco: BlocoRotina) => {
    const texto = (novosItens[bloco.id] || '').trim();
    if (!texto) return;
    mudarBloco({ ...bloco, itens: [...bloco.itens, novoItem(texto)] });
    setNovosItens(atual => ({ ...atual, [bloco.id]: '' }));
  };
  const criarBloco = () => {
    if (!tituloNovo.trim()) return;
    setRascunho(atual => [...atual, novoBloco(tituloNovo, momentoNovo)]);
    setTituloNovo('');
  };
  const salvar = () => {
    const limpo = rascunho
      .map(bloco => ({ ...bloco, titulo: bloco.titulo.trim() || 'Sem nome', ajuda: bloco.ajuda.trim(), itens: bloco.itens.map(item => ({ ...item, texto: item.texto.trim() })).filter(item => item.texto) }));
    const itens = limpo.reduce((soma, bloco) => soma + bloco.itens.length, 0);
    onSalvar(limpo, `Montou o próprio checklist: ${limpo.length} blocos e ${itens} itens`);
    onFechar();
  };

  return (
    <div className="space-y-4" data-testid="meu-dia-montar">
      <div data-meu-dia-reveal className={`${CARTAO} flex flex-wrap items-center gap-3 border-[#f26a2e]/40 bg-orange-50/40 p-4`}>
        <Settings2 className="size-6 shrink-0 text-[#f26a2e]" aria-hidden="true" />
        <p className="min-w-0 flex-1 basis-60 text-sm text-slate-700">
          Este checklist é só seu. Mude os nomes, acrescente, suba, desça ou apague o que quiser. {proprio ? 'Outras pessoas continuam com o delas.' : 'Hoje você usa o modelo padrão da obra.'}
        </p>
        <div className="flex flex-wrap gap-2 max-sm:w-full">
          <button type="button" className={`${BOTAO_SECUNDARIO} max-sm:flex-1`} onClick={onFechar}>
            <X className="size-5" aria-hidden="true" />
            Cancelar
          </button>
          <button type="button" className={`${BOTAO_PRIMARIO} max-sm:flex-1`} onClick={salvar} disabled={!mudou} data-testid="meu-dia-montar-salvar">
            <Save className="size-5" aria-hidden="true" />
            Salvar meu checklist
          </button>
        </div>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        {rascunho.map((bloco, posicao) => (
          <article key={bloco.id} data-meu-dia-reveal className={`${CARTAO} space-y-3 p-4`}>
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 basis-full space-y-1.5 sm:basis-48">
                <span className={ROTULO}>Nome do bloco</span>
                <input className={CAMPO} value={bloco.titulo} maxLength={80} onChange={event => mudarBloco({ ...bloco, titulo: event.target.value })} />
              </label>
              <label className="w-40 space-y-1.5 max-sm:flex-1">
                <span className={ROTULO}>Quando</span>
                <select className={CAMPO} value={bloco.momento} onChange={event => mudarBloco({ ...bloco, momento: event.target.value as MomentoRotina })}>
                  {MOMENTOS.map(momento => <option key={momento.id} value={momento.id}>{momento.nome}</option>)}
                </select>
              </label>
              <div className="flex gap-1">
                <button type="button" className={`${BOTAO_SECUNDARIO} px-3`} disabled={posicao === 0} onClick={() => setRascunho(atual => moverBloco(atual, bloco.id, -1))} aria-label={`Subir o bloco ${bloco.titulo}`}><ArrowUp className="size-4" aria-hidden="true" /></button>
                <button type="button" className={`${BOTAO_SECUNDARIO} px-3`} disabled={posicao === rascunho.length - 1} onClick={() => setRascunho(atual => moverBloco(atual, bloco.id, 1))} aria-label={`Descer o bloco ${bloco.titulo}`}><ArrowDown className="size-4" aria-hidden="true" /></button>
                <button type="button" className={`${BOTAO_SECUNDARIO} px-3 hover:border-rose-300 hover:text-rose-700`} onClick={() => setApagarBloco(bloco)} aria-label={`Apagar o bloco ${bloco.titulo}`}><Trash2 className="size-4" aria-hidden="true" /></button>
              </div>
            </div>
            <label className="block space-y-1.5">
              <span className={ROTULO}>Para que serve (opcional)</span>
              <input className={CAMPO} value={bloco.ajuda} maxLength={120} onChange={event => mudarBloco({ ...bloco, ajuda: event.target.value })} />
            </label>
            <ol className="space-y-1.5">
              {bloco.itens.map((item, indice) => (
                <li key={item.id} className="flex items-start gap-1.5">
                  <span className="w-6 shrink-0 pt-3 text-right text-sm font-bold text-slate-400">{indice + 1}</span>
                  <textarea
                    rows={1}
                    className={`${CAMPO} field-sizing-content min-w-0 flex-1 resize-none py-2.5 leading-snug`}
                    value={item.texto}
                    maxLength={200}
                    onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}
                    aria-label={`Item ${indice + 1} do bloco ${bloco.titulo}`}
                    onChange={event => mudarBloco({ ...bloco, itens: bloco.itens.map(atual => (atual.id === item.id ? { ...atual, texto: event.target.value } : atual)) })}
                  />
                  <button type="button" className={`${BOTAO_SECUNDARIO} px-2.5 max-sm:hidden`} disabled={indice === 0} onClick={() => mudarBloco(moverItem(bloco, item.id, -1))} aria-label={`Subir: ${item.texto}`}><ArrowUp className="size-4" aria-hidden="true" /></button>
                  <button type="button" className={`${BOTAO_SECUNDARIO} px-2.5 max-sm:hidden`} disabled={indice === bloco.itens.length - 1} onClick={() => mudarBloco(moverItem(bloco, item.id, 1))} aria-label={`Descer: ${item.texto}`}><ArrowDown className="size-4" aria-hidden="true" /></button>
                  <button type="button" className={`${BOTAO_SECUNDARIO} px-2.5 hover:border-rose-300 hover:text-rose-700`} onClick={() => mudarBloco({ ...bloco, itens: bloco.itens.filter(atual => atual.id !== item.id) })} aria-label={`Apagar: ${item.texto}`}><X className="size-4" aria-hidden="true" /></button>
                </li>
              ))}
            </ol>
            <form className="flex gap-2" onSubmit={event => { event.preventDefault(); acrescentarItem(bloco); }}>
              <input
                className={`${CAMPO} min-w-0 flex-1`}
                value={novosItens[bloco.id] || ''}
                maxLength={200}
                placeholder="Novo item"
                aria-label={`Novo item no bloco ${bloco.titulo}`}
                onChange={event => setNovosItens(atual => ({ ...atual, [bloco.id]: event.target.value }))}
              />
              <button type="submit" className={`${BOTAO_SECUNDARIO} shrink-0`} disabled={!(novosItens[bloco.id] || '').trim()}>
                <Plus className="size-5" aria-hidden="true" />
                <span className="max-sm:sr-only">Acrescentar</span>
              </button>
            </form>
          </article>
        ))}

        <form data-meu-dia-reveal className={`${CARTAO} space-y-3 border-dashed p-4`} onSubmit={event => { event.preventDefault(); criarBloco(); }}>
          <h3 className="font-bold text-slate-900">Novo bloco</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 basis-full space-y-1.5 sm:basis-48">
              <span className={ROTULO}>Nome</span>
              <input className={CAMPO} value={tituloNovo} maxLength={80} placeholder="Ex.: Drenagem" onChange={event => setTituloNovo(event.target.value)} data-testid="meu-dia-novo-bloco" />
            </label>
            <label className="w-40 space-y-1.5 max-sm:flex-1">
              <span className={ROTULO}>Quando</span>
              <select className={CAMPO} value={momentoNovo} onChange={event => setMomentoNovo(event.target.value as MomentoRotina)}>
                {MOMENTOS.map(momento => <option key={momento.id} value={momento.id}>{momento.nome}</option>)}
              </select>
            </label>
            <button type="submit" className={BOTAO_PRIMARIO} disabled={!tituloNovo.trim()}>
              <Plus className="size-5" aria-hidden="true" />
              Criar bloco
            </button>
          </div>
        </form>
      </div>

      <div className="flex justify-end">
        <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setVoltarPadrao(true)}>
          <RotateCcw className="size-5" aria-hidden="true" />
          Voltar ao modelo padrão
        </button>
      </div>

      <ConfirmDialog
        open={Boolean(apagarBloco)}
        title="Apagar este bloco?"
        description={apagarBloco ? `"${apagarBloco.titulo}" e os ${apagarBloco.itens.length} itens dele saem do seu checklist quando você salvar.` : ''}
        confirmLabel="Apagar bloco"
        onCancel={() => setApagarBloco(null)}
        onConfirm={() => {
          if (apagarBloco) setRascunho(atual => tirarBloco(atual, apagarBloco.id));
          setApagarBloco(null);
        }}
      />
      <ConfirmDialog
        open={voltarPadrao}
        tone="warning"
        title="Voltar ao modelo padrão?"
        description="Os blocos e itens que você criou ou mudou são trocados pelo modelo da obra quando você salvar."
        confirmLabel="Voltar ao padrão"
        onCancel={() => setVoltarPadrao(false)}
        onConfirm={() => { setRascunho(copiarPadrao()); setVoltarPadrao(false); }}
      />
    </div>
  );
}

export function ChecklistDoDia({ rotina, blocos, somente, proprio, onMudarRotina, onSalvarBlocos }: Props) {
  const [montando, setMontando] = useState(false);
  if (montando && onSalvarBlocos) {
    return <Montar blocos={blocos} proprio={proprio} onSalvar={onSalvarBlocos} onFechar={() => setMontando(false)} />;
  }
  return (
    <div className="space-y-3">
      {onSalvarBlocos && (
        <div className="flex justify-end">
          <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setMontando(true)} data-testid="meu-dia-montar-abrir">
            <Settings2 className="size-5" aria-hidden="true" />
            Montar meu checklist
          </button>
        </div>
      )}
      <Marcar rotina={rotina} blocos={blocos} somente={somente} onMudarRotina={onMudarRotina} />
    </div>
  );
}
