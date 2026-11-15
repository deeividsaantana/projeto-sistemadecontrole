import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { CheckCircle2, CloudRain, NotebookPen, Plus, X } from 'lucide-react';
import type { CondicaoClimatica, DiarioObra, ObraLocal } from '../types';
import { AbasDaTela } from '../shared/ui/AbasDaTela';
import { PageHeader } from '../shared/ui/PageHeader';
import { TelaCheia } from '../shared/ui/TelaCheia';
import MapaChuva from './MapaChuva';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO } from './cadastros/estilos';
import { Modal } from '../shared/ui/Modal';
import { Campo, Etapa } from '../shared/ui/Lancamento';
import { useAtalhoNovo } from '../shared/hooks/useAtalhoNovo';
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
  const meses = useMemo(() => {
    const encontrados = mesesComDiario(diarios);
    return encontrados.length > 0 ? encontrados : [{ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 }];
  }, [diarios]);
  const [mesSelecionado, setMesSelecionado] = useState(`${meses[0].ano}-${String(meses[0].mes).padStart(2, '0')}`);
  const [aba, setAba] = useState<'resumo' | 'lancamentos'>('resumo');
  const [aberto, setAberto] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState(`${mesSelecionado}-01`);
  const [obraId, setObraId] = useState('');
  const [rascunho, setRascunho] = useState<Partial<DiarioObra>>({});
  const [ano, mes] = mesSelecionado.split('-').map(Number);
  const registrosDoMes = useMemo(
    () => diarios.filter(item => item.ativo !== false && item.data.startsWith(mesSelecionado)),
    [diarios, mesSelecionado],
  );
  // Procura em todos os registros: trocar o dia para outro mês corrige o que
  // já existe em vez de criar um repetido.
  const diario = diarios.find(item => item.ativo !== false && item.data === diaSelecionado && (item.obraId || '') === obraId);
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
    setAberto(false);
  };

  const abrir = (dia: string, obra = '') => {
    setDiaSelecionado(dia);
    setObraId(obra);
    setRascunho({});
    setAberto(true);
  };
  const diaDeHoje = () => {
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  };
  useAtalhoNovo(() => abrir(diaDeHoje()), podeEditar && !aberto);


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
                { id: 'lancamentos', rotulo: 'Lançamentos', icone: NotebookPen, contador: registrosDoMes.length, contadorRotulo: 'registros no mês', tom: 'neutro' },
                // Relatórios no mesmo padrão das outras abas que lançam (15/11/2026).
                { grupo: 'relatorios', rotulo: 'Relatórios', icone: CloudRain, abas: [
                  { id: 'resumo', rotulo: 'Resumo mensal', icone: CloudRain },
                ] },
              ]}
            />
          )}
          actions={(
            <>
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
            {podeEditar && (
              <button type="button" onClick={() => abrir(diaDeHoje())} className={`${BOTAO_PRIMARIO} max-sm:order-first px-5`} data-testid="pluviometro-novo">
                <Plus className="size-5" aria-hidden="true" /> Novo lançamento
              </button>
            )}
            </>
          )}
        />
      )}
    >
      <div id="pluviometro-dados" role="tabpanel" data-pluviometro-reveal className="space-y-5">
        {aba === 'resumo' ? (
          <MapaChuva diarios={diarios} responsavel={responsavel} mesSelecionado={{ ano, mes }} ocultarFiltro />
        ) : (
          <section className={`${CARTAO} min-w-0 p-3`}>
            <div className="mb-2 flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
              <h2 className="text-base font-black text-slate-900">Lançamentos do mês</h2>
              <span className="shrink-0 text-xs font-semibold text-slate-500">{resumo.diasComChuva} com chuva · {resumo.diasSemDiario} sem registro</span>
            </div>
            <div className="divide-y divide-slate-100">
              {registrosDoMes.length === 0 && <p className="p-5 text-sm text-slate-600">Nenhum lançamento neste mês.{podeEditar ? ' Toque em "Novo lançamento" ou aperte N.' : ''}</p>}
              {[...registrosDoMes].sort((a, b) => b.data.localeCompare(a.data)).map(item => (
                <button key={item.id} type="button" onClick={() => abrir(item.data, item.obraId || '')} className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-emerald-50">
                  <span className="font-semibold text-slate-800">{new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR')}{item.obraId ? ` · ${obras.find(obra => obra.id === item.obraId)?.nome ?? 'Obra'}` : ''}</span>
                  <span className="text-slate-600">{item.precipitacaoMm ?? 0} mm · {item.climaManha}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <Modal
        open={aberto}
        lancamento
        title={diario ? 'Corrigir lançamento do pluviômetro' : 'Novo lançamento do pluviômetro'}
        description="Dia, chuva e horas paradas. Um registro por dia e obra."
        onClose={() => setAberto(false)}
        onSubmit={podeEditar ? salvar : undefined}
        footer={(
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <button type="button" onClick={() => setAberto(false)} className={BOTAO_SECUNDARIO}><X className="size-4" aria-hidden="true" />Fechar</button>
            {podeEditar && <button type="button" onClick={salvar} className={`${BOTAO_PRIMARIO} sm:min-w-40`} data-testid="pluviometro-salvar"><CheckCircle2 className="size-4" aria-hidden="true" />{diario ? 'Salvar correção' : 'Salvar'}</button>}
          </div>
        )}
      >
        <fieldset disabled={!podeEditar} className="grid max-w-3xl gap-4">
          <legend className="sr-only">Dados do dia</legend>
          <Etapa numero={1} titulo="Qual dia e obra?" feita={Boolean(diaSelecionado)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Dia" para="pluv-dia" obrigatorio>
                <input id="pluv-dia" type="date" value={diaSelecionado} onChange={event => { if (event.target.value) { setDiaSelecionado(event.target.value); setRascunho({}); } }} className={CAMPO} />
              </Campo>
              <Campo rotulo="Obra" para="pluv-obra">
                <select id="pluv-obra" value={obraId} onChange={event => { setObraId(event.target.value); setRascunho({}); }} className={CAMPO}>
                  <option value="">Obra geral</option>
                  {obras.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </Campo>
            </div>
          </Etapa>
          <Etapa numero={2} titulo="Como foi o tempo?" ajuda="Pluviômetro em milímetros; em branco quando não mediu." feita={valor.precipitacaoMm !== undefined}>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['climaManha', 'climaTarde'] as const).map(campo => (
                <Campo key={campo} rotulo={campo === 'climaManha' ? 'Clima de manhã' : 'Clima à tarde'} para={`pluv-${campo}`}>
                  <select id={`pluv-${campo}`} value={(valor[campo] as string) || 'Bom'} onChange={event => setRascunho({ ...rascunho, [campo]: event.target.value })} className={CAMPO}>
                    {CLIMAS.map(item => <option key={item}>{item}</option>)}
                  </select>
                </Campo>
              ))}
              <Campo rotulo="Pluviômetro (mm)" para="pluv-mm">
                <input id="pluv-mm" type="number" inputMode="decimal" min="0" step="0.5" value={valor.precipitacaoMm ?? ''} onChange={event => setRascunho({ ...rascunho, precipitacaoMm: event.target.value === '' ? undefined : Number(event.target.value) })} className={CAMPO} />
              </Campo>
              <Campo rotulo="Horas paradas por chuva" para="pluv-horas">
                <input id="pluv-horas" type="number" inputMode="decimal" min="0" step="0.5" value={valor.horasParadasClima ?? ''} onChange={event => setRascunho({ ...rascunho, horasParadasClima: event.target.value === '' ? undefined : Number(event.target.value) })} className={CAMPO} />
              </Campo>
            </div>
          </Etapa>
        </fieldset>
      </Modal>
    </TelaCheia>
  );
}
