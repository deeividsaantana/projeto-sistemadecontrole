/**
 * Diário de obra: guarda só o que não existe em outro lugar — clima, visitas,
 * fotos e observações. Equipes, frota, materiais e viagens do dia são lidos
 * dos próprios módulos, para o diário nunca divergir da operação.
 */
import { useMemo, useRef, useState } from 'react';
import { Camera, CloudRain, NotebookPen, Users } from 'lucide-react';
import type {
  ApontamentoOperacional,
  CondicaoClimatica,
  ControleEquipamentoDiario,
  DiarioObra,
  GrupoEquipe,
  MovimentoMaterial,
  ObraLocal,
  PresencaApontamento,
  TicketJazida,
} from '../types';
import { comprimirImagem, validarFoto } from '../utils/imagem';
import { Card, EmptyState, PageHeader, isoDay, statusTone } from '../shared/ui';

interface DiarioObraTabProps {
  diarios: DiarioObra[];
  obras: ObraLocal[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  apontamentos: ApontamentoOperacional[];
  movimentosMaterial: MovimentoMaterial[];
  ticketsJazida: TicketJazida[];
  responsavel: string;
  podeEditar: boolean;
  onSave: (diario: DiarioObra, isNew: boolean) => void;
}

const CLIMAS: CondicaoClimatica[] = ['Bom', 'Nublado', 'Chuva fraca', 'Chuva forte', 'Impraticável'];
const formatarData = (valor: string) => valor.split('-').reverse().join('/');

export default function DiarioObraTab({
  diarios,
  obras,
  gruposEquipe,
  presencasLink,
  controlesEquipamentos,
  apontamentos,
  movimentosMaterial,
  ticketsJazida,
  responsavel,
  podeEditar,
  onSave,
}: DiarioObraTabProps) {
  const hoje = isoDay(new Date());
  const [dia, setDia] = useState(hoje);
  const [obraId, setObraId] = useState('');
  const inputFoto = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState('');

  const diario = useMemo(
    () => diarios.find(item => item.data === dia && (item.obraId || '') === obraId),
    [diarios, dia, obraId],
  );

  const [rascunho, setRascunho] = useState<Partial<DiarioObra>>({});
  const valor = { ...diario, ...rascunho } as Partial<DiarioObra>;

  // Tudo abaixo é lido dos módulos do dia: o diário não guarda cópia disso.
  const resumo = useMemo(() => {
    const presencas = presencasLink.filter(item => item.data === dia);
    const frota = controlesEquipamentos.filter(item => item.data === dia);
    const horas = apontamentos.filter(item => item.data === dia);
    return {
      presentes: presencas.filter(item => ['Presente', 'Atraso', 'Saída antecipada'].includes(item.status)).length,
      ausentes: presencas.filter(item => item.status === 'Ausente').length,
      equipes: new Set(presencas.map(item => item.grupoId)).size,
      equipesSemApontamento: gruposEquipe.filter(grupo => grupo.status !== 'inativo'
        && !presencas.some(item => item.grupoId === grupo.id)).length,
      frota,
      operando: frota.filter(item => item.status === 'Em operação').length,
      manutencao: frota.filter(item => item.status.includes('manutenção')).length,
      horasApontadas: horas.reduce((soma, item) => soma + (Number(item.horas) || 0), 0),
      materiais: movimentosMaterial.filter(item => item.data === dia),
      viagens: ticketsJazida.filter(item => item.data === dia).length,
    };
  }, [dia, presencasLink, controlesEquipamentos, apontamentos, movimentosMaterial, ticketsJazida, gruposEquipe]);

  // A foto é reduzida no navegador antes de entrar no diário: o backup viaja em
  // blocos, e uma foto de celular inteira dentro do JSON quebra a sincronização
  // de todo mundo, não só de quem tirou a foto.
  const receberFoto = async (arquivo?: File) => {
    if (!arquivo) return;
    if (inputFoto.current) inputFoto.current.value = '';
    try {
      const foto = await comprimirImagem(arquivo);
      const problema = validarFoto(foto);
      if (problema) {
        setErro(problema);
        return;
      }
      setErro('');
      setRascunho(atual => ({
        ...atual,
        fotos: [...(atual.fotos || diario?.fotos || []), foto],
      }));
    } catch {
      setErro('Não foi possível ler a imagem.');
    }
  };

  const salvar = () => {
    const agora = new Date().toISOString();
    onSave({
      id: diario?.id || `diario-${dia}-${obraId || 'geral'}`,
      data: dia,
      obraId: obraId || undefined,
      climaManha: (valor.climaManha as CondicaoClimatica) || 'Bom',
      climaTarde: (valor.climaTarde as CondicaoClimatica) || 'Bom',
      horasParadasClima: Number(valor.horasParadasClima) || undefined,
      visitas: valor.visitas?.trim() || undefined,
      observacao: valor.observacao?.trim() || undefined,
      fotos: valor.fotos,
      responsavel: diario?.responsavel || responsavel,
      criadoEm: diario?.criadoEm || agora,
      atualizadoEm: agora,
    }, !diario);
    setRascunho({});
  };

  return (
    <div id="diario-obra-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Diário de Obra"
        description="O dia consolidado. Clima, visitas e fotos são registrados aqui; o resto vem dos módulos."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <select value={obraId} onChange={event => { setObraId(event.target.value); setRascunho({}); }} aria-label="Obra" className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500">
              <option value="">Obra geral</option>
              {obras.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
            <input type="date" value={dia} onChange={event => { setDia(event.target.value || hoje); setRascunho({}); }} aria-label="Dia do diário" className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-emerald-500" />
          </div>
        )}
      />

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Presentes', valor: String(resumo.presentes) },
          { label: 'Equipes com apontamento', valor: String(resumo.equipes) },
          { label: 'Frota informada', valor: String(resumo.frota.length) },
          { label: 'Horas apontadas', valor: `${resumo.horasApontadas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h` },
        ].map(item => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block text-2xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      <input ref={inputFoto} type="file" accept="image/*" capture="environment" hidden onChange={event => void receberFoto(event.target.files?.[0])} />

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card
          className="min-w-0"
          title={`Registro do dia · ${formatarData(dia)}`}
          description={diario ? `Última atualização por ${diario.responsavel}` : 'Ainda não registrado'}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(['climaManha', 'climaTarde'] as const).map(campo => (
              <label key={campo} className="text-xs font-bold text-slate-600">
                {campo === 'climaManha' ? 'Clima manhã' : 'Clima tarde'}
                <select
                  value={(valor[campo] as string) || 'Bom'}
                  disabled={!podeEditar}
                  onChange={event => setRascunho({ ...rascunho, [campo]: event.target.value as CondicaoClimatica })}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 disabled:bg-slate-50"
                >
                  {CLIMAS.map(item => <option key={item}>{item}</option>)}
                </select>
              </label>
            ))}
            <label className="text-xs font-bold text-slate-600">
              Horas paradas por chuva
              <input
                type="number" min="0" step="0.5"
                value={valor.horasParadasClima ?? ''}
                disabled={!podeEditar}
                onChange={event => setRascunho({ ...rascunho, horasParadasClima: Number(event.target.value) })}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 disabled:bg-slate-50"
              />
            </label>
            <label className="text-xs font-bold text-slate-600">
              Fotos do dia
              <button
                type="button"
                disabled={!podeEditar}
                onClick={() => inputFoto.current?.click()}
                className="mt-1 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 disabled:opacity-50"
              >
                <Camera className="h-4 w-4" /> {(valor.fotos?.length || 0)} foto(s)
              </button>
              {erro && <span className="mt-1 block text-[11px] font-bold text-rose-700">{erro}</span>}
            </label>
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">
              Visitas
              <input
                value={valor.visitas || ''}
                disabled={!podeEditar}
                onChange={event => setRascunho({ ...rascunho, visitas: event.target.value })}
                placeholder="Quem esteve na obra"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 disabled:bg-slate-50"
              />
            </label>
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">
              Observações do dia
              <textarea
                value={valor.observacao || ''}
                disabled={!podeEditar}
                onChange={event => setRascunho({ ...rascunho, observacao: event.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 disabled:bg-slate-50"
              />
            </label>
          </div>
          {(valor.fotos?.length || 0) > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {valor.fotos?.map((foto, indice) => (
                <img key={indice} src={foto} alt={`Foto ${indice + 1} do dia`} className="h-20 rounded-lg border border-slate-200 object-cover" />
              ))}
            </div>
          )}
          {podeEditar && (
            <button type="button" onClick={salvar} className="mt-4 min-h-11 w-full rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-800 sm:w-auto">
              {diario ? 'Atualizar diário' : 'Registrar diário'}
            </button>
          )}
        </Card>

        <Card className="min-w-0" title="O que a operação registrou no dia" flush>
          <ul className="divide-y divide-slate-100 text-xs">
            {[
              { rotulo: 'Presentes / ausentes', valor: `${resumo.presentes} / ${resumo.ausentes}` },
              { rotulo: 'Equipes sem apontamento', valor: String(resumo.equipesSemApontamento) },
              { rotulo: 'Frota em operação', valor: String(resumo.operando) },
              { rotulo: 'Frota em manutenção', valor: String(resumo.manutencao) },
              { rotulo: 'Viagens', valor: String(resumo.viagens) },
              { rotulo: 'Movimentos de material', valor: String(resumo.materiais.length) },
            ].map(item => (
              <li key={item.rotulo} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="text-slate-600">{item.rotulo}</span>
                <strong className="font-mono text-slate-900">{item.valor}</strong>
              </li>
            ))}
          </ul>
          {resumo.frota.length === 0 && resumo.presentes === 0 && (
            <div className="border-t border-slate-100">
              <EmptyState icon={Users} title="Nenhum lançamento operacional neste dia" compact />
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4" title="Diários registrados" flush>
        {diarios.length === 0 ? (
          <EmptyState icon={NotebookPen} title="Nenhum diário registrado" description="Registre o clima e as observações do dia." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...diarios].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 15).map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => { setDia(item.data); setObraId(item.obraId || ''); setRascunho({}); }}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-xs transition-colors hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <strong className="block text-slate-800">{formatarData(item.data)}</strong>
                    <span className="block truncate text-[10px] text-slate-400">
                      {obras.find(obra => obra.id === item.obraId)?.nome || 'Obra geral'}
                      {item.visitas ? ` · visitas: ${item.visitas}` : ''}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <CloudRain className="h-3.5 w-3.5 text-slate-400" />
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(item.climaManha)}`}>{item.climaManha}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
