/**
 * Auditoria: leitura analítica do histórico de ações — quem mexeu, onde e o
 * quê, com destaque para o que é sensível (exclusão, inativação e alterações em
 * telas que mudam dinheiro, contrato ou permissão). O log é a única fonte: não
 * existe contador salvo que possa divergir do histórico.
 */
import { useMemo, useState } from 'react';
import { Activity, Clock3, ShieldCheck, Users } from 'lucide-react';
import type { HistoryLog } from '../types';
import {
  contarPor,
  ehSensivel,
  filtrarLogs,
  resumoAuditoria,
  telasDosLogs,
  usuariosDosLogs,
} from '../utils/auditoria';
import {
  StatCard,
  Badge,
  EmptyState,
  PageHeader,
  Pagination,
  PeriodFilter,
  TableBody,
  TableHead,
  TableShell,
  buildPeriod,
  type PeriodValue,
} from '../shared/ui';

interface AuditoriaTabProps {
  logs: HistoryLog[];
}

const POR_PAGINA = 25;

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

export default function AuditoriaTab({ logs }: AuditoriaTabProps) {
  const [period, setPeriod] = useState<PeriodValue>(() => buildPeriod('mes'));
  const [usuario, setUsuario] = useState('');
  const [tela, setTela] = useState('');
  const [busca, setBusca] = useState('');
  const [somenteSensiveis, setSomenteSensiveis] = useState(false);
  const [pagina, setPagina] = useState(1);

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
  const paginaAtual = Math.min(pagina, Math.max(1, Math.ceil(filtrados.length / POR_PAGINA)));
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  return (
    <div id="auditoria-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Auditoria"
        description="Quem alterou o quê e quando, com destaque para ações sensíveis."
        actions={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Ações no período', valor: resumo.total, tone: 'info' as const, icone: Clock3 },
          { label: 'Ações sensíveis', valor: resumo.sensiveis, tone: 'neutral' as const, icone: ShieldCheck },
          { label: 'Exclusões', valor: resumo.exclusoes, tone: 'danger' as const, icone: ShieldCheck },
          { label: 'Usuários ativos', valor: resumo.usuarios, tone: 'neutral' as const, icone: Users },
        ].map(item => (
          <StatCard key={item.label} label={item.label} value={item.valor} tone={item.tone} icon={item.icone} />
        ))}
      </section>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
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

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold text-slate-600">
          Usuário
          <select value={usuario} onChange={event => { setUsuario(event.target.value); setPagina(1); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
            <option value="">Todos</option>
            {usuariosDosLogs(logs).map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Tela
          <select value={tela} onChange={event => { setTela(event.target.value); setPagina(1); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
            <option value="">Todas</option>
            {telasDosLogs(logs).map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Buscar
          <input
            value={busca}
            onChange={event => { setBusca(event.target.value); setPagina(1); }}
            placeholder="Ação, tela, usuário ou descrição"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500"
          />
        </label>
        <label className="flex items-end gap-2 text-xs font-bold text-slate-600">
          <span className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
            <input type="checkbox" checked={somenteSensiveis} onChange={event => { setSomenteSensiveis(event.target.checked); setPagina(1); }} />
            Só ações sensíveis
          </span>
        </label>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {visiveis.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nenhuma ação no período" description="Ajuste o período ou os filtros." />
        ) : (
          <TableShell minWidth={900}>
            <TableHead>
              <tr>
                <th className="p-3">Quando</th>
                <th className="p-3">Usuário</th>
                <th className="p-3">Ação</th>
                <th className="p-3">Tela</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Sensível</th>
              </tr>
            </TableHead>
            <TableBody>
              {visiveis.map(log => (
                <tr key={log.id} className={`transition-colors hover:bg-slate-50 ${ehSensivel(log) ? 'bg-amber-50/40' : ''}`}>
                  <td className="p-3 font-mono text-slate-600">{formatarMomento(log.timestamp)}</td>
                  <td className="p-3 font-bold text-slate-800">{log.usuario}</td>
                  <td className="p-3"><Badge tone={tomDaAcao(log.acao)}>{log.acao}</Badge></td>
                  <td className="p-3 text-slate-600">{log.tela}</td>
                  <td className="max-w-96 truncate p-3 text-slate-600" title={log.descricao}>{log.descricao}</td>
                  <td className="p-3 text-slate-600">{ehSensivel(log) ? 'Sim' : '—'}</td>
                </tr>
              ))}
            </TableBody>
          </TableShell>
        )}
      </div>

      {filtrados.length > POR_PAGINA && (
        <div className="mt-3">
          <Pagination
            page={paginaAtual}
            totalPages={Math.ceil(filtrados.length / POR_PAGINA)}
            onChange={setPagina}
          />
        </div>
      )}
    </div>
  );
}
