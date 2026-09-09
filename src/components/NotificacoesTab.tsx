/**
 * Notificações: histórico completo e preferências do dispositivo. O sino guarda
 * poucas mensagens e some com o tempo; aqui fica o histórico do que chegou e o
 * controle de quais categorias de alerta o usuário quer ver.
 *
 * A preferência é do navegador, não da conta: silenciar uma categoria no celular
 * do encarregado não pode apagar o alerta da tela do gestor.
 */
import { useMemo, useState } from 'react';
import { ArrowUpRight, Bell, BellOff, CheckCheck } from 'lucide-react';
import type { AppNotification } from '../types';
import type { Alerta } from '../utils/alertas';
import {
  agruparNotificacoes,
  alertasVisiveis,
  contarNaoLidas,
  notificacoesVisiveis,
  type PreferenciasNotificacao,
} from '../utils/notificacoes';
import { Badge, EmptyState, PageHeader } from '../shared/ui';

interface NotificacoesTabProps {
  notificacoes: AppNotification[];
  alertas: Alerta[];
  preferencias: PreferenciasNotificacao;
  onPreferenciasChange: (preferencias: PreferenciasNotificacao) => void;
  onMarcarTodasLidas: () => void;
  onNavigate: (tab: string) => void;
}

const formatarDia = (dia: string) => dia.split('-').reverse().join('/');

const tomDoTipo = (tipo: AppNotification['type']) => {
  if (tipo === 'success') return 'success' as const;
  if (tipo === 'warning') return 'warning' as const;
  if (tipo === 'error') return 'danger' as const;
  return 'info' as const;
};

export default function NotificacoesTab({
  notificacoes,
  alertas,
  preferencias,
  onPreferenciasChange,
  onMarcarTodasLidas,
  onNavigate,
}: NotificacoesTabProps) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [somenteNaoLidas, setSomenteNaoLidas] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const visiveis = useMemo(() => {
    const base = notificacoesVisiveis(notificacoes, preferencias);
    return somenteNaoLidas ? base.filter(item => !item.read) : base;
  }, [notificacoes, preferencias, somenteNaoLidas]);

  const grupos = useMemo(() => agruparNotificacoes(visiveis, hoje), [visiveis, hoje]);
  const categorias = useMemo(
    () => [...new Set(alertas.map(item => item.titulo))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [alertas],
  );
  const ativos = alertasVisiveis(alertas, preferencias);
  const selecionada = visiveis.find(item => item.id === selectedId) || visiveis[0];

  const alternarCategoria = (categoria: string) => {
    const silenciadas = preferencias.categoriasSilenciadas.includes(categoria)
      ? preferencias.categoriasSilenciadas.filter(item => item !== categoria)
      : [...preferencias.categoriasSilenciadas, categoria];
    onPreferenciasChange({ ...preferencias, categoriasSilenciadas: silenciadas });
  };

  return (
    <div id="notificacoes-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Notificações"
        description="Histórico do que chegou e o que você quer ser avisado neste dispositivo."
        actions={(
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSomenteNaoLidas(valor => !valor)}
              aria-pressed={somenteNaoLidas}
              className={`min-h-10 rounded-lg border px-3 text-xs font-bold transition-colors ${somenteNaoLidas
                ? 'border-emerald-600 bg-emerald-700 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-400'}`}
            >
              Só não lidas
            </button>
            <button
              type="button"
              onClick={onMarcarTodasLidas}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
            >
              <CheckCheck className="h-4 w-4" /> Marcar como lidas
            </button>
          </div>
        )}
      />

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Notificações', valor: String(notificacoes.length) },
          { label: 'Não lidas', valor: String(contarNaoLidas(notificacoes)) },
          { label: 'Alertas ativos', valor: String(ativos.length) },
          { label: 'Categorias silenciadas', valor: String(preferencias.categoriasSilenciadas.length) },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block text-2xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Alertas por categoria</h2>
        {categorias.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Nenhum alerta ativo agora — nada para silenciar.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {categorias.map(categoria => {
              const silenciada = preferencias.categoriasSilenciadas.includes(categoria);
              return (
                <li key={categoria}>
                  <button
                    type="button"
                    onClick={() => alternarCategoria(categoria)}
                    aria-pressed={!silenciada}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors ${silenciada
                      ? 'border-slate-200 bg-slate-50 text-slate-400'
                      : 'border-emerald-600 bg-emerald-700 text-white'}`}
                  >
                    {silenciada ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                    {categoria}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <label className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-600">
          <input
            type="checkbox"
            checked={preferencias.mostrarSistema}
            onChange={event => onPreferenciasChange({ ...preferencias, mostrarSistema: event.target.checked })}
          />
          Mostrar avisos do sistema (sincronização, importação)
        </label>
        <p className="mt-2 text-[11px] text-slate-500">
          A preferência vale só neste dispositivo. Silenciar aqui não apaga o alerta para as outras pessoas.
        </p>
      </section>

      {ativos.length > 0 && (
        <section className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-rose-800">Alertas ativos agora</h2>
          <ul className="mt-2 space-y-1.5">
            {ativos.map(alerta => (
              <li key={alerta.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(alerta.tab)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-left text-xs transition-colors hover:border-rose-400"
                >
                  <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">{alerta.titulo}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">{alerta.mensagem}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4 grid items-start gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(23rem,.95fr)]">
        {grupos.length === 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <EmptyState icon={Bell} title="Sem notificações" description="Avisos de sincronização e de cadastro aparecem aqui." />
          </div>
        ) : (
          <ol className="space-y-4 rounded-[3px] border border-slate-200 bg-white p-4">
            {grupos.map(([dia, itens]) => (
              <li key={dia}>
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{formatarDia(dia)}</h2>
                <ul className="mt-2 space-y-1.5">
                  {itens.map(item => {
                    const active = selecionada?.id === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          aria-pressed={active}
                          className={`w-full rounded-[3px] border p-3 text-left transition-all ${active ? 'border-emerald-500 bg-emerald-50' : item.read ? 'border-slate-200 bg-white hover:border-emerald-300' : 'border-emerald-200 bg-emerald-50'}`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={tomDoTipo(item.type)}>{item.title}</Badge>
                            <span className="font-mono text-[11px] text-slate-500">{item.timestamp.slice(11, 16) || item.timestamp}</span>
                            <span className="text-[11px] text-slate-400">{item.source}</span>
                            {!item.read && <i className="ml-auto size-2 bg-emerald-500" aria-label="Não lida" />}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-700">{item.message}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
        {selecionada && (
          <aside key={selecionada.id} className="sticky top-4 rounded-[3px] border border-slate-200 bg-white p-5 xl:min-h-[25rem]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-700">Detalhes da notificação</p>
              <span className="font-mono text-xs text-slate-500">{selecionada.timestamp.slice(11, 16) || selecionada.timestamp}</span>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-[3px] border border-slate-200 bg-white"><Bell className="h-5 w-5 text-emerald-700" /></span>
              <div><Badge tone={tomDoTipo(selecionada.type)}>{selecionada.title}</Badge><p className="mt-1 text-xs text-slate-500">{selecionada.source}</p></div>
            </div>
            <h2 className="mt-6 text-3xl font-black leading-[.98] tracking-[-.04em] text-slate-950">{selecionada.title}</h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">{selecionada.message}</p>
            <div className="mt-6 border-y border-slate-100 py-4 text-xs text-slate-500">
              Esta mensagem faz parte do histórico sincronizado. As preferências de exibição continuam específicas deste dispositivo.
            </div>
            <button type="button" onClick={() => onNavigate('dashboard')} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800">
              Abrir visão operacional <ArrowUpRight className="h-4 w-4" />
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}
