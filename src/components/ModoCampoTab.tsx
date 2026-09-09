/**
 * Modo campo: a tela do celular de quem está na obra. Mostra o dia em números e
 * seis ações grandes — nada de caçar item em menu de quarenta linhas com luva
 * na mão. Todo número aqui é lido dos módulos; a tela não guarda nada próprio.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  CloudOff,
  Megaphone,
  NotebookPen,
  Users,
  Wifi,
} from 'lucide-react';
import type {
  ControleEquipamentoDiario,
  Ocorrencia,
  PresencaApontamento,
  RegistroProducao,
} from '../types';
import { listOfflineCommands } from '../utils/offlineQueue';
import { PageHeader, isoDay } from '../shared/ui';

interface ModoCampoTabProps {
  presencasLink: PresencaApontamento[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  producao: RegistroProducao[];
  ocorrencias: Ocorrencia[];
  nuvemConectada: boolean;
  onNavigate: (tab: string) => void;
}

const ACOES: Array<{ tab: string; rotulo: string; icone: typeof Activity }> = [
  { tab: 'central-operacional', rotulo: 'Frota do dia', icone: Activity },
  { tab: 'presenca', rotulo: 'Presença', icone: Users },
  { tab: 'producao', rotulo: 'Lançar produção', icone: BarChart3 },
  { tab: 'checklist', rotulo: 'Checklist', icone: ClipboardCheck },
  { tab: 'ocorrencias', rotulo: 'Ocorrência', icone: Megaphone },
  { tab: 'diario-obra', rotulo: 'Diário de obra', icone: NotebookPen },
];

export default function ModoCampoTab({
  presencasLink,
  controlesEquipamentos,
  producao,
  ocorrencias,
  nuvemConectada,
  onNavigate,
}: ModoCampoTabProps) {
  const hoje = isoDay(new Date());
  const [pendentes, setPendentes] = useState(0);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);

  // A fila offline é a resposta para "meu registro sumiu?": enquanto houver item
  // aqui, o dado está guardado no aparelho e sobe quando a internet voltar.
  useEffect(() => {
    let ativo = true;
    const atualizar = () => {
      listOfflineCommands()
        .then(comandos => { if (ativo) setPendentes(comandos.length); })
        .catch(() => { if (ativo) setPendentes(0); });
    };
    atualizar();
    const intervalo = window.setInterval(atualizar, 30_000);
    const aoMudarConexao = () => setOnline(navigator.onLine);
    window.addEventListener('online', aoMudarConexao);
    window.addEventListener('offline', aoMudarConexao);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      window.removeEventListener('online', aoMudarConexao);
      window.removeEventListener('offline', aoMudarConexao);
    };
  }, []);

  const resumo = useMemo(() => {
    const presencas = presencasLink.filter(item => item.data === hoje);
    const frota = controlesEquipamentos.filter(item => item.data === hoje);
    return {
      presentes: presencas.filter(item => ['Presente', 'Atraso', 'Saída antecipada'].includes(item.status)).length,
      ausentes: presencas.filter(item => item.status === 'Ausente').length,
      operando: frota.filter(item => item.status === 'Em operação').length,
      frota: frota.length,
      producao: producao.filter(item => item.ativo !== false && item.data === hoje).length,
      ocorrencias: ocorrencias.filter(item => item.ativo !== false && item.data === hoje).length,
    };
  }, [hoje, presencasLink, controlesEquipamentos, producao, ocorrencias]);

  return (
    <div id="modo-campo-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Modo Campo"
        description={`Resumo de hoje (${hoje.split('-').reverse().join('/')}) e as ações do dia, em botões grandes.`}
      />

      <div className={`mt-4 flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 ${online && nuvemConectada ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        {online && nuvemConectada
          ? <Wifi className="h-4 w-4 shrink-0 text-emerald-600" />
          : <CloudOff className="h-4 w-4 shrink-0 text-amber-600" />}
        <p className={`text-xs font-bold ${online && nuvemConectada ? 'text-emerald-900' : 'text-amber-900'}`}>
          {online && nuvemConectada
            ? 'Conectado — o que você registrar sobe na hora.'
            : 'Sem conexão agora — pode registrar mesmo assim, sobe quando a internet voltar.'}
        </p>
        {pendentes > 0 && (
          <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[11px] font-bold text-white">
            {pendentes} registro(s) guardado(s) no aparelho
          </span>
        )}
      </div>

      <section className="mt-4 grid grid-cols-2 gap-2.5">
        {[
          { label: 'Presentes hoje', valor: String(resumo.presentes), alerta: resumo.presentes === 0 },
          { label: 'Ausentes', valor: String(resumo.ausentes), alerta: resumo.ausentes > 0 },
          { label: 'Frota operando', valor: `${resumo.operando}/${resumo.frota}`, alerta: resumo.frota === 0 },
          { label: 'Produção lançada', valor: String(resumo.producao), alerta: resumo.producao === 0 },
        ].map(item => (
          <div key={item.label} className={`min-w-0 rounded-lg border p-4 ${item.alerta ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block text-2xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      {resumo.ocorrencias > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          {resumo.ocorrencias} ocorrência(s) registrada(s) hoje
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {ACOES.map(acao => (
          <button
            key={acao.tab}
            type="button"
            onClick={() => onNavigate(acao.tab)}
            className="field-action flex min-h-24 flex-col items-start justify-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-500 hover:bg-emerald-50/40 hover:shadow-lg active:translate-y-0 active:bg-emerald-100"
          >
            <acao.icone className="h-6 w-6 text-emerald-700" />
            <span className="text-sm font-bold text-slate-800">{acao.rotulo}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
