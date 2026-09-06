/**
 * Modo campo: a tela do celular de quem está na obra. Mostra o dia em números e
 * seis ações grandes — nada de caçar item em menu de quarenta linhas com luva
 * na mão. Todo número aqui é lido dos módulos; a tela não guarda nada próprio.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  ClipboardCheck,
  CloudOff,
  Fuel,
  NotebookPen,
  RefreshCw,
  Search,
  Truck,
  Users,
  Wifi,
  Wrench,
} from 'lucide-react';
import type {
  ControleEquipamentoDiario,
  Ocorrencia,
  PresencaApontamento,
  RegistroProducao,
} from '../types';
import { listOfflineCommands } from '../utils/offlineQueue';
import { CompactMetric, DataTable, PageHeader, QuickAction, StatusBadge, isoDay } from '../shared/ui';

interface ModoCampoTabProps {
  presencasLink: PresencaApontamento[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  producao: RegistroProducao[];
  ocorrencias: Ocorrencia[];
  nuvemConectada: boolean;
  onNavigate: (tab: string) => void;
}


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

  // Últimos apontamentos do dia, lidos dos módulos: nenhuma coleção nova.
  const ultimosApontamentos = useMemo(() => [
    ...presencasLink.filter(item => item.data === hoje).map(item => ({
      id: `presenca-${item.id}`,
      horario: item.horaEnvio || '',
      tipo: 'Presença',
      codigo: item.grupoNome || 'Equipe',
      descricao: item.funcionarioNome || '',
      status: item.status,
    })),
    ...controlesEquipamentos.filter(item => item.data === hoje).map(item => ({
      id: `frota-${item.id}`,
      horario: item.horaSaida || item.horaEntradaManutencao || '',
      tipo: 'Frota',
      codigo: item.prefixo,
      descricao: item.nomeMotorista || item.observacao || '',
      status: item.status,
    })),
    ...producao.filter(item => item.ativo !== false && item.data === hoje).map(item => ({
      id: `producao-${item.id}`,
      horario: '',
      tipo: 'Produção',
      codigo: item.servicoDescricao,
      descricao: `${item.quantidade} ${item.unidade}`,
      status: 'Concluída',
    })),
  ].sort((a, b) => (b.horario || '').localeCompare(a.horario || '')).slice(0, 8),
  [hoje, presencasLink, controlesEquipamentos, producao]);

  const ACOES_PRINCIPAIS = [
    { titulo: 'Apontar presença', tab: 'presenca', icone: Users, estado: 'operacao' as const },
    { titulo: 'Registrar viagem', tab: 'tickets-jazida', icone: Truck, estado: 'confirmar' as const },
    { titulo: 'Registrar abastecimento', tab: 'lancamentos', icone: Fuel, estado: 'manutencao' as const },
    { titulo: 'Abrir manutenção', tab: 'manutencao', icone: Wrench, estado: 'erro' as const },
  ];

  const ACESSO_RAPIDO = [
    { titulo: 'Consultar equipamento', tab: 'consulta-geral', icone: Search },
    { titulo: 'Ver pendências', tab: 'pendencias', icone: ClipboardCheck },
    { titulo: 'Diário de obra', tab: 'diario-obra', icone: NotebookPen },
    { titulo: 'Sincronizar dados', tab: 'administracao', icone: RefreshCw },
  ];

  return (
    <div id="modo-campo-tab" className="min-h-full w-full bg-[#f6f7f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Modo Campo"
        description="Interface simplificada para uso em campo."
        actions={(
          <span className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold ${online && nuvemConectada ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {online && nuvemConectada ? <Wifi className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
            {online && nuvemConectada ? 'Sincronizado' : 'Sem conexão'}
            {pendentes > 0 && ` · ${pendentes} no aparelho`}
          </span>
        )}
      />

      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        {ACOES_PRINCIPAIS.map(acao => (
          <QuickAction
            key={acao.tab}
            titulo={acao.titulo}
            icone={acao.icone}
            estado={acao.estado}
            onClick={() => onNavigate(acao.tab)}
            className="min-h-20"
          />
        ))}
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CompactMetric label="Presentes hoje" valor={resumo.presentes} contexto="colaboradores" icone={Users} estado="operacao" onClick={() => onNavigate('presenca')} />
        <CompactMetric label="Ausentes" valor={resumo.ausentes} contexto="colaboradores" icone={Users} estado="erro" onClick={() => onNavigate('presenca')} />
        <CompactMetric label="Frota operando" valor={`${resumo.operando}/${resumo.frota}`} contexto="equipamentos" icone={Truck} estado="confirmar" onClick={() => onNavigate('central-operacional')} />
        <CompactMetric label="Produção lançada" valor={resumo.producao} contexto="registros" icone={ClipboardCheck} estado="neutro" onClick={() => onNavigate('producao')} />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h2 className="text-[13px] font-semibold text-slate-800">Últimos apontamentos</h2>
            <button type="button" onClick={() => onNavigate('periodo')} className="text-[12px] font-semibold text-[#087353] hover:text-[#065f3c]">Ver todos</button>
          </header>
          <DataTable
            larguraMinima={520}
            itens={ultimosApontamentos}
            chaveDe={item => item.id}
            vazio={<p className="px-4 py-10 text-center text-[13px] text-slate-500">Nenhum apontamento registrado hoje.</p>}
            colunas={[
              { chave: 'horario', titulo: 'Horário', render: item => <span className="tabular-nums text-slate-500">{item.horario || '—'}</span> },
              { chave: 'tipo', titulo: 'Tipo', render: item => item.tipo },
              { chave: 'codigo', titulo: 'Código', render: item => <span className="font-semibold text-slate-800">{item.codigo}</span> },
              { chave: 'descricao', titulo: 'Descrição', render: item => <span className="line-clamp-1">{item.descricao}</span>, ocultarNoCelular: true },
              { chave: 'status', titulo: 'Status', render: item => <StatusBadge>{item.status}</StatusBadge> },
            ]}
          />
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-800">Acesso rápido</h2>
          <ul className="divide-y divide-slate-100">
            {ACESSO_RAPIDO.map(item => (
              <li key={item.tab}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.tab)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                    <item.icone className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">{item.titulo}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}
