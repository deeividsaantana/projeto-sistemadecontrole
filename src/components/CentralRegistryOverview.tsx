import { useMemo, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, Database, Search, Truck, Users } from 'lucide-react';
import type { Empresa, Equipamento, Funcionario, ObraLocal } from '../types';
import { isSupplier, isVehicle, registrySummary } from '../masterData/centralRegistry';
import { downloadCentralRegistryWorkbook } from '../masterData/centralWorkbookExport';
import { CountUp } from '../shared/ui';

type CentralModule = 'funcionarios' | 'equipamentos' | 'veiculos' | 'fornecedores' | 'empresas' | 'obras' | 'etapas';

interface Props {
  empresas: Empresa[];
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  onSelectModule: (module: CentralModule) => void;
}

const normalize = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function CentralRegistryOverview({ empresas, obras, equipamentos, funcionarios, onSelectModule }: Props) {
  const [query, setQuery] = useState('');
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const summary = registrySummary({ empresas, obras, equipamentos, funcionarios });

  const results = useMemo(() => {
    const q = normalize(query).trim();
    if (!q) return [];
    return [
      ...funcionarios.map(item => ({ module: 'funcionarios' as const, title: `${item.matricula || 'Sem matrícula'} — ${item.nome}`, detail: `${item.cargo} · ${item.liderNome || item.responsavelArea || 'Sem líder/responsável'}` })),
      ...equipamentos.map(item => ({ module: (isVehicle(item) ? 'veiculos' : 'equipamentos') as 'veiculos' | 'equipamentos', title: `${item.prefixo} — ${item.nome}`, detail: `${item.placa || item.seriePlaca || 'Sem placa/série'} · ${item.status}` })),
      ...empresas.map(item => ({ module: (isSupplier(item) ? 'fornecedores' : 'empresas') as 'fornecedores' | 'empresas', title: item.nome, detail: `${item.cnpj || 'Sem CNPJ'} · ${item.responsavel || 'Sem responsável'}` })),
      ...obras.map(item => ({ module: 'obras' as const, title: item.nome, detail: `${item.endereco || 'Sem endereço'} · ${item.status}` })),
    ].filter(item => normalize(`${item.title} ${item.detail}`).includes(q)).slice(0, 8);
  }, [query, empresas, equipamentos, funcionarios, obras]);

  const exportWorkbook = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadCentralRegistryWorkbook({ empresas, obras, equipamentos, funcionarios });
      setExportResult({ success: true, message: 'BASE_CADASTROS compatível com Power Query exportada com sucesso.' });
    } catch (error) {
      setExportResult({ success: false, message: error instanceof Error ? error.message : 'Falha ao exportar a base mestre.' });
    } finally {
      setExporting(false);
    }
  };

  const cards = [
    { label: 'Colaboradores ativos', value: summary.colaboradoresAtivos, icon: Users, module: 'funcionarios' as const },
    { label: 'Desmobilizados', value: summary.colaboradoresDesmobilizados, icon: Users, module: 'funcionarios' as const },
    { label: 'Equipamentos ativos', value: summary.equipamentosAtivos, icon: Truck, module: 'equipamentos' as const },
    { label: 'Veículos', value: summary.veiculos, icon: Truck, module: 'veiculos' as const },
    { label: 'Fornecedores', value: summary.fornecedores, icon: Building2, module: 'fornecedores' as const },
    { label: 'Inconsistências', value: summary.inconsistencias, icon: AlertTriangle, module: 'funcionarios' as const },
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-slate-900 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-700"><Database className="h-4 w-4" /> Base central oficial</div>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Painel geral de cadastros</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">Fonte única para efetivo, equipamentos, combustível, viagens e estacas. O arquivo de Materiais não participa desta sincronização.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportWorkbook} disabled={exporting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-800 transition hover:border-emerald-600 hover:text-emerald-700 disabled:opacity-60">
            <Database className="h-4 w-4" /> {exporting ? 'EXPORTANDO...' : 'EXPORTAR BASE_CADASTROS'}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map(card => <button key={card.label} onClick={() => onSelectModule(card.module)} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md">
          <card.icon className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${card.label === 'Inconsistências' && card.value > 0 ? 'text-amber-600' : 'text-emerald-700'}`} />
          <strong className="mt-3 block text-2xl font-black tabular-nums text-slate-950"><CountUp value={card.value} /></strong>
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{card.label}</span>
        </button>)}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisa global: matrícula, nome, prefixo, placa, fornecedor, líder, ramo ou local" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-xs text-slate-900 outline-none focus:border-emerald-600" />
          {query && <div className="absolute z-30 mt-2 max-h-80 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            {results.length === 0 ? <p className="p-3 text-xs text-slate-500">Nenhum registro encontrado.</p> : results.map((item, index) => <button key={`${item.module}-${item.title}-${index}`} onClick={() => onSelectModule(item.module)} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-slate-100">
              <strong className="block text-xs text-slate-900">{item.title}</strong><span className="text-[10px] text-slate-500">{item.detail}</span>
            </button>)}
          </div>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
          <div className="flex items-center gap-2 font-black text-slate-800"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Base central</div>
          <p className={exportResult?.success === false ? 'mt-1 text-rose-600' : 'mt-1 text-emerald-700'}>{exportResult?.message || `${(empresas.length + obras.length + equipamentos.length + funcionarios.length).toLocaleString('pt-BR')} registros mestres disponíveis.`}</p>
        </div>
      </div>
    </section>
  );
}
