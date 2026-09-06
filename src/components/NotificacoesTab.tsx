/**
 * Notificações: histórico completo e preferências do dispositivo. O sino guarda
 * poucas mensagens e some com o tempo; aqui fica o histórico do que chegou e o
 * controle de quais categorias de alerta o usuário quer ver.
 *
 * A preferência é do navegador, não da conta: silenciar uma categoria no celular
 * do encarregado não pode apagar o alerta da tela do gestor.
 */
import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Bell, BellOff, CheckCheck, ChevronRight } from 'lucide-react';
import type { AppNotification } from '../types';
import type { Alerta } from '../utils/alertas';
import {
  agruparNotificacoes,
  alertasVisiveis,
  contarNaoLidas,
  notificacoesVisiveis,
  type PreferenciasNotificacao,
} from '../utils/notificacoes';
import { Button, DataTable, EmptyState, PageHeader, StatusBadge } from '../shared/ui';

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
  const [abaAtiva, setAbaAtiva] = useState('todas');

  const visiveis = useMemo(
    () => notificacoesVisiveis(notificacoes, preferencias),
    [notificacoes, preferencias],
  );
  const categorias = useMemo(
    () => [...new Set(alertas.map(item => item.titulo))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [alertas],
  );
  const ativos = alertasVisiveis(alertas, preferencias);

  const alternarCategoria = (categoria: string) => {
    const silenciadas = preferencias.categoriasSilenciadas.includes(categoria)
      ? preferencias.categoriasSilenciadas.filter(item => item !== categoria)
      : [...preferencias.categoriasSilenciadas, categoria];
    onPreferenciasChange({ ...preferencias, categoriasSilenciadas: silenciadas });
  };

  // Abas da referência: fonte serve de categoria, sem inventar campo novo.
  const abas = useMemo(() => {
    const fontes = [...new Set(notificacoes.map(item => item.source))];
    return [
      { id: 'todas', rotulo: `Todas (${notificacoes.length})` },
      { id: 'nao-lidas', rotulo: `Não lidas (${contarNaoLidas(notificacoes)})` },
      ...fontes.map(fonte => ({ id: fonte, rotulo: fonte })),
    ];
  }, [notificacoes]);

  const listadas = useMemo(() => {
    if (abaAtiva === 'todas') return visiveis;
    if (abaAtiva === 'nao-lidas') return visiveis.filter(item => !item.read);
    return visiveis.filter(item => item.source === abaAtiva);
  }, [visiveis, abaAtiva]);

  return (
    <div id="notificacoes-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Notificações"
        description="Acompanhe os alertas e atualizações do sistema."
        actions={<Button variant="primary" icon={CheckCheck} onClick={onMarcarTodasLidas}>Marcar todas como lidas</Button>}
      />

      <div className="mt-4 flex flex-wrap gap-1.5">
        {abas.map(aba => (
          <button
            key={aba.id}
            type="button"
            onClick={() => setAbaAtiva(aba.id)}
            aria-pressed={abaAtiva === aba.id}
            className={`h-9 rounded-lg px-4 text-[12px] font-semibold transition-colors ${abaAtiva === aba.id
              ? 'bg-[#087353] text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-400'}`}
          >
            {aba.rotulo}
          </button>
        ))}
      </div>

      {ativos.length > 0 && (
        <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-4 py-3 text-[12px] font-semibold text-slate-700">Alertas ativos agora</h2>
          <ul className="divide-y divide-slate-100">
            {ativos.map(alerta => (
              <li key={alerta.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(alerta.tab)}
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                >
                  <StatusBadge>{alerta.titulo}</StatusBadge>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">{alerta.mensagem}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <DataTable
          larguraMinima={860}
          itens={listadas}
          chaveDe={item => item.id}
          vazio={<EmptyState icon={Bell} title="Sem notificações" description="Avisos de sincronização e de cadastro aparecem aqui." />}
          colunas={[
            {
              chave: 'tipo',
              titulo: 'Tipo',
              render: item => (
                <span className={`grid size-8 place-items-center rounded-lg ${item.type === 'error' ? 'bg-rose-50 text-rose-600' : item.type === 'warning' ? 'bg-amber-50 text-amber-600' : item.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
                  <Bell className="h-4 w-4" />
                </span>
              ),
              larguraMinima: 60,
            },
            {
              chave: 'mensagem',
              titulo: 'Mensagem',
              render: item => (
                <span className="block min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-slate-800">{item.title}</span>
                  <span className="block truncate text-[12px] text-slate-500">{item.message}</span>
                </span>
              ),
              larguraMinima: 320,
            },
            {
              chave: 'quando',
              titulo: 'Data e hora',
              render: item => <span className="tabular-nums text-slate-500">{item.timestamp.length > 5 ? `${formatarDia(item.timestamp.slice(0, 10))} ${item.timestamp.slice(11, 16)}` : item.timestamp}</span>,
              ocultarNoCelular: true,
            },
            {
              chave: 'status',
              titulo: 'Status',
              render: item => <StatusBadge>{item.read ? 'Lida' : 'Não lida'}</StatusBadge>,
            },
          ]}
          acoes={[{ rotulo: 'Marcar como lidas', onSelect: () => onMarcarTodasLidas() }]}
        />
      </div>

      <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-[13px] font-semibold text-slate-700">Preferências deste dispositivo</summary>
        <p className="mt-2 text-[12px] text-slate-500">
          Escolha quais categorias de alerta aparecem no sino. A preferência vale só neste aparelho: silenciar aqui não
          apaga o alerta para as outras pessoas.
        </p>
        {categorias.length === 0 ? (
          <p className="mt-2 text-[12px] text-slate-500">Nenhum alerta ativo agora — nada para silenciar.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {categorias.map(categoria => {
              const silenciada = preferencias.categoriasSilenciadas.includes(categoria);
              return (
                <li key={categoria}>
                  <button
                    type="button"
                    onClick={() => alternarCategoria(categoria)}
                    aria-pressed={!silenciada}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold transition-colors ${silenciada
                      ? 'border-slate-200 bg-slate-50 text-slate-400'
                      : 'border-[#087353] bg-[#087353] text-white'}`}
                  >
                    {silenciada ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                    {categoria}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <label className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={preferencias.mostrarSistema}
            onChange={event => onPreferenciasChange({ ...preferencias, mostrarSistema: event.target.checked })}
          />
          Mostrar avisos do sistema (sincronização, importação)
        </label>
      </details>
    </div>
  );

}
