import { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { CloudRain, NotebookPen } from 'lucide-react';
import type { CondicaoClimatica, DiarioObra, ObraLocal } from '../types';
import { AbasDaTela } from '../shared/ui/AbasDaTela';
import { PageHeader } from '../shared/ui/PageHeader';
import { TelaCheia } from '../shared/ui/TelaCheia';
import MapaChuva from './MapaChuva';
import { CAMPO, CARTAO } from './cadastros/estilos';
import { mesesComDiario, montarMesDeChuva } from '../utils/mapaChuva';

interface PluviometroTabProps {
  diarios: DiarioObra[];
  obras: ObraLocal[];
  responsavel: string;
  podeEditar: boolean;
  onSave: (diario: DiarioObra, isNew: boolean) => void;
}

const CLIMAS: CondicaoClimatica[] = ['Bom', 'Nublado', 'Chuva fraca', 'Chuva forte', 'Impraticável'];
const hoje = new Date();

export default function PluviometroTab({ diarios, obras, responsavel, podeEditar, onSave }: PluviometroTabProps) {
  const escopo = useRef<HTMLElement>(null);
  const salvarRef = useRef<HTMLButtonElement>(null);
  const meses = useMemo(() => {
    const encontrados = mesesComDiario(diarios);
    return encontrados.length > 0 ? encontrados : [{ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }];
  }, [diarios]);
  const [mesSelecionado, setMesSelecionado] = useState(`${meses[0].ano}-${String(meses[0].mes).padStart(2, '0')}`);
  const [aba, setAba] = useState<'resumo' | 'lancamentos'>('resumo');
  const [diaSelecionado, setDiaSelecionado] = useState(`${mesSelecionado}-01`);
  const [obraId, setObraId] = useState('');
  const [rascunho, setRascunho] = useState<Partial<DiarioObra>>({});
  const [ano, mes] = mesSelecionado.split('-').map(Number);
  const registrosDoMes = useMemo(
    () => diarios.filter(item => item.ativo !== false && item.data.startsWith(mesSelecionado)),
    [diarios, mesSelecionado],
  );
  const diario = registrosDoMes.find(item => item.data === diaSelecionado && (item.obraId || '') === obraId);
  const valor = { ...diario, ...rascunho };
  const resumo = useMemo(() => montarMesDeChuva(diarios, ano, mes), [diarios, ano, mes]);

  useGSAP(() => {
    if (!escopo.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(escopo.current.querySelectorAll('[data-pluviometro-reveal]'), { opacity: 0, y: 12 }, {
      opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'power3.out', clearProps: 'transform,opacity',
    });
  }, { scope: escopo, dependencies: [aba, mesSelecionado] });

  const trocarMes = (valorMes: string) => {
    setMesSelecionado(valorMes);
    setDiaSelecionado(`${valorMes}-01`);
    setRascunho({});
  };

  const salvar = () => {
    const agora = new Date().toISOString();
    onSave({
      id: diario?.id || `diario-${diaSelecionado}-${obraId || 'geral'}`,
      data: diaSelecionado,
      obraId: obraId || undefined,
      climaManha: (valor.climaManha as CondicaoClimatica) || 'Bom',
      climaTarde: (valor.climaTarde as CondicaoClimatica) || 'Bom',
      horasParadasClima: Number(valor.horasParadasClima) || undefined,
      precipitacaoMm: Number(valor.precipitacaoMm) || undefined,
      visitas: valor.visitas?.trim() || undefined,
      observacao: valor.observacao?.trim() || undefined,
      fotos: valor.fotos,
      responsavel: diario?.responsavel || responsavel,
      ativo: diario?.ativo ?? true,
      criadoEm: diario?.criadoEm || agora,
      atualizadoEm: agora,
    }, !diario);
    setRascunho({});
  };

  useEffect(() => {
    const teclar = (event: KeyboardEvent) => {
      const alvo = event.target as HTMLElement | null;
      const digitando = alvo?.matches('input, textarea, select, [contenteditable="true"]');
      if (event.altKey) return;
      if (event.key.toLowerCase() === 'n' && !digitando && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setAba('lancamentos');
        setDiaSelecionado(`${mesSelecionado}-01`);
        setObraId('');
        setRascunho({});
        window.setTimeout(() => salvarRef.current?.focus(), 0);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && aba === 'lancamentos' && podeEditar) {
        event.preventDefault();
        salvar();
      }
    };
    window.addEventListener('keydown', teclar);
    return () => window.removeEventListener('keydown', teclar);
  }, [aba, mesSelecionado, podeEditar, salvar]);

  return (
    <TelaCheia
      ref={escopo}
      id="pluviometro-tab"
      rotulo="Pluviômetro"
      longa
      rotuloDados="Resumo e lançamentos do pluviômetro"
      cabecalho={(
        <PageHeader
          eyebrow="Obra"
          title="Pluviômetro"
          abas={(
            <AbasDaTela
              id="pluviometro"
              rotulo="Subtelas do pluviômetro"
              ativa={aba}
              onTrocar={id => setAba(id === 'lancamentos' ? 'lancamentos' : 'resumo')}
              idPainel="pluviometro-dados"
              testId="pluviometro-abas"
              abas={[
                { id: 'resumo', rotulo: 'Resumo mensal', icone: CloudRain },
                { id: 'lancamentos', rotulo: 'Lançamentos', icone: NotebookPen, contador: registrosDoMes.length, contadorRotulo: 'registros no mês', tom: 'neutro' },
              ]}
            />
          )}
          actions={(
            <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600">
              <span>Mês e ano</span>
              <select value={mesSelecionado} onChange={event => trocarMes(event.target.value)} className="bg-transparent py-2 text-sm text-slate-900" aria-label="Filtrar mês e ano">
                {meses.map(item => (
                  <option key={`${item.ano}-${item.mes}`} value={`${item.ano}-${String(item.mes).padStart(2, '0')}`}>
                    {new Date(item.ano, item.mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </label>
          )}
        />
      )}
    >
      <div id="pluviometro-dados" role="tabpanel" data-pluviometro-reveal className="space-y-5">
        {aba === 'resumo' ? (
          <MapaChuva diarios={diarios} responsavel={responsavel} mesSelecionado={{ ano, mes }} ocultarFiltro />
        ) : (
          <section className={`${CARTAO} min-w-0 p-3`}>
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                  <h2 className="text-base font-black text-slate-900">Lançamentos do mês</h2>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">{resumo.diasComChuva} com chuva · {resumo.diasSemDiario} sem registro</span>
                </div>
                <div className={`${CARTAO} divide-y divide-slate-100`}>
                  {registrosDoMes.length === 0 && <p className="p-5 text-sm text-slate-600">Nenhum lançamento neste mês.</p>}
                  {registrosDoMes.sort((a, b) => b.data.localeCompare(a.data)).map(item => (
                    <button key={item.id} type="button" onClick={() => { setDiaSelecionado(item.data); setObraId(item.obraId || ''); setRascunho({}); }} className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-emerald-50">
                      <span className="font-semibold text-slate-800">{new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                      <span className="text-slate-600">{item.precipitacaoMm ?? 0} mm · {item.climaManha}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={`${CARTAO} sticky top-2 p-3 shadow-sm`}>
                <h2 className="text-base font-bold text-slate-900">{diario ? 'Editar lançamento' : 'Novo lançamento'}</h2>
                <label className="mt-2 block text-xs font-bold text-slate-600">Dia
                  <input type="date" value={diaSelecionado} onChange={event => { setDiaSelecionado(event.target.value); setRascunho({}); }} className={`${CAMPO} mt-1`} />
                </label>
                <label className="mt-2 block text-xs font-bold text-slate-600">Obra
                  <select value={obraId} onChange={event => { setObraId(event.target.value); setRascunho({}); }} className={`${CAMPO} mt-1`}>
                    <option value="">Obra geral</option>
                    {obras.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                  </select>
                </label>
                {(['climaManha', 'climaTarde'] as const).map(campo => (
                  <label key={campo} className="mt-2 block text-xs font-bold text-slate-600">{campo === 'climaManha' ? 'Clima manhã' : 'Clima tarde'}
                    <select disabled={!podeEditar} value={(valor[campo] as string) || 'Bom'} onChange={event => setRascunho({ ...rascunho, [campo]: event.target.value })} className={`${CAMPO} mt-1 disabled:bg-slate-50`}>
                      {CLIMAS.map(item => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                ))}
                <label className="mt-2 block text-xs font-bold text-slate-600">Pluviômetro (mm)
                  <input disabled={!podeEditar} type="number" min="0" step="0.5" value={valor.precipitacaoMm ?? ''} onChange={event => setRascunho({ ...rascunho, precipitacaoMm: Number(event.target.value) })} className={`${CAMPO} mt-1 disabled:bg-slate-50`} />
                </label>
                <label className="mt-2 block text-xs font-bold text-slate-600">Horas paradas por chuva
                  <input disabled={!podeEditar} type="number" min="0" step="0.5" value={valor.horasParadasClima ?? ''} onChange={event => setRascunho({ ...rascunho, horasParadasClima: Number(event.target.value) })} className={`${CAMPO} mt-1 disabled:bg-slate-50`} />
                </label>
                {podeEditar && <button ref={salvarRef} type="button" onClick={salvar} className="mt-4 min-h-11 w-full rounded-lg bg-[#176b4d] px-4 text-sm font-bold text-white hover:opacity-90">{diario ? 'Atualizar lançamento' : 'Registrar lançamento'}</button>}
              </div>
            </div>
          </section>
        )}
      </div>
    </TelaCheia>
  );
}
