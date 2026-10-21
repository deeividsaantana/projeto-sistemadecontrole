/**
 * Histórico de ações, dentro da Administração: quem mexeu, onde e o quê, com
 * destaque para o que é sensível (exclusão, inativação e alterações em
 * telas que mudam dinheiro, contrato ou permissão). O log é a única fonte: não
 * existe contador salvo que possa divergir do histórico.
 */
import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { HistoryLog } from '../../types';
import {
  contarPor,
  ehSensivel,
  filtrarLogs,
  resumoAuditoria,
  telasDosLogs,
  usuariosDosLogs,
} from '../../utils/auditoria';
import {
  Badge,
  EmptyState,
  PeriodFilter,
  TabelaPadrao,
  buildPeriod,
  type ColunaTabela,
  type PeriodValue,
} from '../../shared/ui';

interface HistoricoAcoesProps {
  logs: HistoryLog[];
}

const formatarMomento = (timestamp: string) => {
  const data = timestamp?.slice(0, 10);
  const hora = timestamp?.slice(11, 16);
  return data ? `${data.split('-').reverse().join('/')}${hora ? ` ${hora}` : ''}` : timestamp;
};

const tomDaAcao = (acao: HistoryLog['acao']) => {
  if (acao === 'Excluiu') return 'danger' as const;
  if (acao === 'Criou') return 'success' as const;
  if (acao === 'Inativou' || acao === 'Desmobilizou') return 'warning' as const;
  return 'info' as const;
};

const COLUNAS_HISTORICO: ColunaTabela<HistoryLog>[] = [
  { chave: 'quando', titulo: 'Quando', valorOrdenacao: log => log.timestamp, render: log => <span className="whitespace-nowrap tabular-nums">{formatarMomento(log.timestamp)}</span> },
  { chave: 'usuario', titulo: 'Usuário', valorOrdenacao: log => log.usuario, render: log => <strong className="text-slate-900">{log.usuario}</strong>, dica: log => log.usuario },
  { chave: 'acao', titulo: 'Ação', valorOrdenacao: log => log.acao, render: log => <Badge tone={tomDaAcao(log.acao)}>{log.acao}</Badge> },
  { chave: 'tela', titulo: 'Tela', valorOrdenacao: log => log.tela, render: log => log.tela },
  { chave: 'descricao', titulo: 'Descrição', larguraMinima: 280, valorOrdenacao: log => log.descricao, render: log => log.descricao, dica: log => log.descricao },
  { chave: 'sensivel', titulo: 'Sensível', valorOrdenacao: log => (ehSensivel(log) ? 1 : 0), render: log => (ehSensivel(log) ? 'Sim' : '—') },
];

export default function HistoricoAcoes({ logs }: HistoricoAcoesProps) {
  const [period, setPeriod] = useState<PeriodValue>(() => buildPeriod('mes'));
  const [usuario, setUsuario] = useState('');
  const [tela, setTela] = useState('');
  const [busca, setBusca] = useState('');
  const [somenteSensiveis, setSomenteSensiveis] = useState(false);

  const filtrados = useMemo(() => filtrarLogs(logs, {
    inicio: period.from,
    fim: period.to,
    usuario: usuario || undefined,
    tela: tela || undefined,
    busca,
    somenteSensiveis,
  }), [logs, period.from, period.to, usuario, tela, busca, somenteSensiveis]);

  const resumo = resumoAuditoria(filtrados);
  const porUsuario = useMemo(() => contarPor(filtrados, item => item.usuario).slice(0, 6), [filtrados]);
  const porTela = useMemo(() => contarPor(filtrados, item => item.tela).slice(0, 6), [filtrados]);

  return (
    <div id="administracao-historico" className="space-y-4">
      <div data-admin-reveal className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Quem alterou o quê e quando, com destaque para ações sensíveis.</p>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <section data-admin-reveal className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Ações no período', valor: String(resumo.total) },
          { label: 'Ações sensíveis', valor: String(resumo.sensiveis) },
          { label: 'Exclusões', valor: String(resumo.exclusoes) },
          { label: 'Usuários ativos', valor: String(resumo.usuarios) },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block text-2xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      <div data-admin-reveal className="grid gap-3 lg:grid-cols-2">
        {[['Por usuário', porUsuario], ['Por tela', porTela]].map(([titulo, dados]) => (
          <section key={String(titulo)} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{String(titulo)}</h2>
            {(dados as Array<{ grupo: string; quantidade: number }>).length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">Sem registros no período.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-xs">
                {(dados as Array<{ grupo: string; quantidade: number }>).map(item => (
                  <li key={item.grupo} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-slate-700">{item.grupo}</span>
                    <span className="shrink-0 font-mono font-bold text-slate-900">{item.quantidade}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div data-admin-reveal className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold text-slate-600">
          Usuário
          <select value={usuario} onChange={event => { setUsuario(event.target.value); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
            <option value="">Todos</option>
            {usuariosDosLogs(logs).map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Tela
          <select value={tela} onChange={event => { setTela(event.target.value); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
            <option value="">Todas</option>
            {telasDosLogs(logs).map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Buscar
          <input
            value={busca}
            onChange={event => { setBusca(event.target.value); }}
            placeholder="Ação, tela, usuário ou descrição"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500"
          />
        </label>
        <label className="flex items-end gap-2 text-xs font-bold text-slate-600">
          <span className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
            <input type="checkbox" checked={somenteSensiveis} onChange={event => { setSomenteSensiveis(event.target.checked); }} />
            Só ações sensíveis
          </span>
        </label>
      </div>

      <div data-admin-reveal>
        <TabelaPadrao
          titulo="Histórico de ações"
          linhas={filtrados}
          colunas={COLUNAS_HISTORICO}
          idDaLinha={log => log.id}
          nomeDoItem={{ um: 'ação', varios: 'ações' }}
          classeLinha={log => (ehSensivel(log) ? 'bg-amber-50/50' : undefined)}
          vazio={<EmptyState icon={ShieldCheck} title="Nenhuma ação no período" description="Ajuste o período ou os filtros." />}
        />
      </div>
    </div>
  );
}
