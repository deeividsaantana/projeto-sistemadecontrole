/**
 * Pluviômetro: a leitura de chuva do dia (mm), o clima e as horas paradas, e o
 * mapa de chuvas do mês logo abaixo. Substituiu o Diário de Obra no menu em
 * 11/11/2026, a pedido do usuário.
 *
 * A leitura mora no mesmo registro do dia que o diário usava (DiarioObra): o
 * histórico continua inteiro, a sincronização e a auditoria são as mesmas, e o
 * que já existia no registro (visitas, fotos, observações) é preservado ao
 * salvar.
 */
import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { CalendarDays, Clock, CloudRain, Droplets, Save } from 'lucide-react';
import MapaChuva from './MapaChuva';
import type { CondicaoClimatica, DiarioObra, ObraLocal } from '../types';
import { Card, CartaoIndicador, EmptyState, PageHeader, isoDay, statusTone } from '../shared/ui';
import { useEntradaDeLista } from '../shared/hooks/useEntradaDeLista';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { formatarData } from '../utils/formato';
import { montarMesDeChuva } from '../utils/mapaChuva';
import { CAMPO } from './cadastros/estilos';

interface PluviometroTabProps {
  leituras: DiarioObra[];
  obras: ObraLocal[];
  responsavel: string;
  podeEditar: boolean;
  onSave: (leitura: DiarioObra, isNew: boolean) => void;
}

const CLIMAS: CondicaoClimatica[] = ['Bom', 'Nublado', 'Chuva fraca', 'Chuva forte', 'Impraticável'];

const mm = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mm`;

export default function PluviometroTab({ leituras, obras, responsavel, podeEditar, onSave }: PluviometroTabProps) {
  const hoje = isoDay(new Date());
  const [dia, setDia] = useState(hoje);
  const [obraId, setObraId] = useState('');
  const escopo = useRef<HTMLElement>(null);
  // Indicadores renascem a cada troca de dia; o resto da tela só entra uma vez.
  const escopoIndicadores = useEntradaDeLista<HTMLElement>([dia, obraId]);

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-pluviometro-reveal]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo });

  // Soft delete: registro inativado sai da tela sem sumir do histórico.
  const ativos = useMemo(() => leituras.filter(item => item.ativo !== false), [leituras]);

  const registro = useMemo(
    () => ativos.find(item => item.data === dia && (item.obraId || '') === obraId),
    [ativos, dia, obraId],
  );

  const [rascunho, setRascunho] = useState<Partial<DiarioObra>>({});
  const valor = { ...registro, ...rascunho } as Partial<DiarioObra>;

  const [ano, mes] = dia.split('-').map(Number);
  const doMes = useMemo(() => montarMesDeChuva(leituras, ano, mes), [leituras, ano, mes]);

  const trocar = (proximoDia: string, proximaObra: string) => {
    setDia(proximoDia || hoje);
    setObraId(proximaObra);
    setRascunho({});
  };

  const salvar = () => {
    const agora = new Date().toISOString();
    onSave({
      // O que o registro já tinha (visitas, fotos, observações) vai junto.
      ...registro,
      id: registro?.id || `diario-${dia}-${obraId || 'geral'}`,
      data: dia,
      obraId: obraId || undefined,
      climaManha: (valor.climaManha as CondicaoClimatica) || 'Bom',
      climaTarde: (valor.climaTarde as CondicaoClimatica) || 'Bom',
      horasParadasClima: Number(valor.horasParadasClima) || undefined,
      precipitacaoMm: Number(valor.precipitacaoMm) || undefined,
      responsavel: registro?.responsavel || responsavel,
      ativo: registro?.ativo ?? true,
      criadoEm: registro?.criadoEm || agora,
      atualizadoEm: agora,
    }, !registro);
    setRascunho({});
  };

  const textoBotao = registro ? 'Atualizar leitura' : 'Salvar leitura';

  return (
    <TelaCheia ref={escopo} id="pluviometro-tab" rotulo="Pluviômetro" longa rotuloDados="Leitura do dia e mapa de chuvas"
      cabecalho={(
        <PageHeader
          title="Pluviômetro"
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <label>
                <span className="sr-only">Obra</span>
                <select value={obraId} onChange={event => trocar(dia, event.target.value)} className={CAMPO}>
                  <option value="">Obra geral</option>
                  {obras.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Dia da leitura</span>
                <input type="date" value={dia} onChange={event => trocar(event.target.value, obraId)} className={CAMPO} />
              </label>
              {/* No computador o cabeçalho fica parado: salvar está sempre à vista. */}
              {podeEditar && (
                <button type="button" onClick={salvar} className="hidden min-h-10 items-center gap-2 rounded-lg bg-[#176b4d] px-4 text-sm font-bold text-white transition hover:opacity-90 lg:inline-flex">
                  <Save className="size-4" aria-hidden="true" />
                  {textoBotao}
                </button>
              )}
            </div>
          )}
        />
      )}
    >
      <section ref={escopoIndicadores} aria-label="Números de chuva" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoIndicador dados={{ 'data-linha-lista': true }} rotulo="Chuva no dia" valor={registro?.precipitacaoMm ? mm(registro.precipitacaoMm) : registro ? '0 mm' : 'Sem leitura'} detalhe={formatarData(dia)} icone={Droplets} tom={registro?.precipitacaoMm ? 'verde' : 'neutro'} />
        <CartaoIndicador dados={{ 'data-linha-lista': true }} rotulo="Chuva no mês" valor={mm(doMes.totalMm)} detalhe={doMes.rotulo} icone={CloudRain} />
        <CartaoIndicador dados={{ 'data-linha-lista': true }} rotulo="Dias com chuva" valor={doMes.diasComChuva} detalhe="no mês" icone={CalendarDays} />
        <CartaoIndicador dados={{ 'data-linha-lista': true }} rotulo="Horas paradas" valor={`${doMes.horasParadas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`} detalhe="por chuva no mês" icone={Clock} />
      </section>

      <div data-pluviometro-reveal className="grid gap-4 xl:grid-cols-2">
        <Card
          className="min-w-0"
          title={`Leitura do dia · ${formatarData(dia)}`}
          description={registro ? `Última atualização por ${registro.responsavel}` : 'Ainda sem leitura neste dia'}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">
              Chuva medida (mm)
              <input
                type="number" min="0" step="0.5" inputMode="decimal"
                value={valor.precipitacaoMm ?? ''}
                disabled={!podeEditar}
                onChange={event => setRascunho({ ...rascunho, precipitacaoMm: Number(event.target.value) })}
                placeholder="0"
                className={`${CAMPO} mt-1`}
              />
              <span className="mt-1 block text-xs font-medium text-[#5b6870]">Não choveu? Deixe 0 e salve, para o dia não ficar em branco.</span>
            </label>
            {(['climaManha', 'climaTarde'] as const).map(campo => (
              <label key={campo} className="text-xs font-bold text-slate-600">
                {campo === 'climaManha' ? 'Clima de manhã' : 'Clima à tarde'}
                <select
                  value={(valor[campo] as string) || 'Bom'}
                  disabled={!podeEditar}
                  onChange={event => setRascunho({ ...rascunho, [campo]: event.target.value as CondicaoClimatica })}
                  className={`${CAMPO} mt-1`}
                >
                  {CLIMAS.map(item => <option key={item}>{item}</option>)}
                </select>
              </label>
            ))}
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">
              Horas paradas por chuva
              <input
                type="number" min="0" step="0.5" inputMode="decimal"
                value={valor.horasParadasClima ?? ''}
                disabled={!podeEditar}
                onChange={event => setRascunho({ ...rascunho, horasParadasClima: Number(event.target.value) })}
                placeholder="0"
                className={`${CAMPO} mt-1`}
              />
            </label>
          </div>
          {podeEditar && (
            <button type="button" onClick={salvar} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#176b4d] px-4 text-sm font-bold text-white transition hover:opacity-90 sm:w-auto lg:hidden">
              <Save className="size-4" aria-hidden="true" />
              {textoBotao}
            </button>
          )}
        </Card>

        <Card className="min-w-0" title="Últimas leituras" flush>
          {ativos.length === 0 ? (
            <EmptyState icon={CloudRain} title="Nenhuma leitura registrada" description="Lance a chuva do dia ao lado." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {[...ativos].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 10).map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => trocar(item.data, item.obraId || '')}
                    className="flex min-h-11 w-full items-center justify-between gap-3 px-5 py-3 text-left text-xs transition-colors hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <strong className="block text-slate-800">{formatarData(item.data)}</strong>
                      <span className="block truncate text-xs text-[#5b6870]">
                        {obras.find(obra => obra.id === item.obraId)?.nome || 'Obra geral'}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <strong className="tabular-nums text-slate-900">{mm(Number(item.precipitacaoMm) || 0)}</strong>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(item.climaManha)}`}>{item.climaManha}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div data-pluviometro-reveal>
        <MapaChuva diarios={leituras} responsavel={responsavel} />
      </div>
    </TelaCheia>
  );
}
