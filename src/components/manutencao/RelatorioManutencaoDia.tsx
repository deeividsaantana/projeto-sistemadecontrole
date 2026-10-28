/**
 * Manutenção › Relatório: o dia escolhido (hoje: até agora), uma linha por
 * equipamento com cada período parado, totais no rodapé, quadro por tipo e
 * por motivo e quantos já foram conferidos. A planilha sai pelo botão
 * "Exportar Excel" do cabeçalho da aba.
 */
import { BarChart3, ClipboardList } from 'lucide-react';
import { formatarMinutos } from '../../utils/horasParadasDoDia';
import { diaAntes } from '../../utils/conferenciaManutencao';
import type { LinhaRelatorioManutencao, RelatorioManutencaoDia as Relatorio } from '../../utils/relatorioManutencaoDia';
import { EmptyState, TabelaPadrao, type ColunaTabela } from '../../shared/ui';
import { CAMPO, CARTAO, FOCO, ROTULO } from '../cadastros/estilos';
import { SeloSituacao } from './CartaoParada';

const dataBr = (data: string) => data.split('-').reverse().join('/');

const colunas: ColunaTabela<LinhaRelatorioManutencao>[] = [
  {
    chave: 'equipamento',
    titulo: 'Equipamento',
    larguraMinima: 140,
    valorOrdenacao: linha => linha.prefixo,
    dica: linha => `${linha.prefixo} · ${linha.tipo}`,
    render: linha => <><strong className="block text-slate-900">{linha.prefixo}</strong><span className="block text-xs text-[#5b6870]">{linha.tipo}</span></>,
  },
  { chave: 'os', titulo: 'OS', valorOrdenacao: linha => linha.ordemNumero, render: linha => linha.ordemNumero || '—' },
  {
    chave: 'periodos',
    titulo: 'Períodos',
    larguraMinima: 180,
    dica: linha => linha.parada.periodos.map(periodo => `${periodo.inicio} → ${periodo.fim ?? 'em aberto'}`).join(' · ') || linha.parada.motivoInconsistencia,
    render: linha => (linha.parada.periodos.length
      ? linha.parada.periodos.map((periodo, indice) => <span key={indice} className="block whitespace-nowrap tabular-nums">{periodo.inicio} → {periodo.fim ?? 'em aberto'}</span>)
      : <span className="text-amber-900">{linha.parada.motivoInconsistencia || 'Horas não fecham'}</span>),
  },
  {
    chave: 'descontos',
    titulo: 'Pausas',
    alinhamento: 'direita',
    valorOrdenacao: linha => linha.parada.periodos.reduce((total, periodo) => total + periodo.descontoMin, 0),
    render: linha => {
      const desconto = linha.parada.periodos.reduce((total, periodo) => total + periodo.descontoMin, 0);
      return desconto ? `−${formatarMinutos(desconto)}` : '—';
    },
  },
  { chave: 'horas', titulo: 'Horas do dia', alinhamento: 'direita', valorOrdenacao: linha => linha.parada.totalMin, render: linha => <strong>{formatarMinutos(linha.parada.totalMin)}</strong> },
  { chave: 'situacao', titulo: 'Situação', valorOrdenacao: linha => linha.grupo, render: linha => <SeloSituacao parada={linha.parada} grupo={linha.grupo} /> },
  {
    chave: 'conferido',
    titulo: 'Conferido',
    valorOrdenacao: linha => (linha.conferido ? 1 : 0),
    render: linha => (linha.grupo === 'OK' ? 'Não precisa' : linha.conferido ? 'Sim' : <strong className="text-amber-900">Falta</strong>),
  },
];

interface Props {
  relatorio: Relatorio;
  hoje: string;
  onData: (data: string) => void;
  motivos: ReadonlyArray<{ motivo: string; totalMin: number; equipamentos: number }>;
}

export function RelatorioManutencaoDia({ relatorio, hoje, onData, motivos }: Props) {
  const ontem = diaAntes(hoje);
  const pendencia = relatorio.fechado
    ? 'Dia fechado: tudo conferido.'
    : relatorio.data === hoje
      ? 'Dia em andamento: os números contam até agora.'
      : relatorio.parados
        ? `Dia aberto: ${relatorio.parados} sem liberação.`
        : `Dia aberto: falta conferir ${relatorio.aConferir}.`;
  const maiorTipo = relatorio.porTipo[0]?.totalMin || 1;
  const maiorMotivo = motivos[0]?.totalMin || 1;
  const atalho = (ativo: boolean) => `inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-bold transition ${FOCO} ${ativo ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500'}`;

  return (
    <>
      <section data-manutencao-reveal aria-label="Resumo do dia" className={`${CARTAO} grid gap-4 p-4 lg:grid-cols-[auto_1fr] lg:items-center`}>
        <div className="flex flex-wrap items-end gap-2">
          <label className={`${ROTULO} block`}>
            Dia
            <input type="date" value={relatorio.data} max={hoje} onChange={event => event.target.value && onData(event.target.value)} className={`${CAMPO} mt-1 block sm:w-48`} />
          </label>
          <button type="button" onClick={() => onData(hoje)} aria-pressed={relatorio.data === hoje} className={atalho(relatorio.data === hoje)}>Hoje</button>
          <button type="button" onClick={() => onData(ontem)} aria-pressed={relatorio.data === ontem} className={atalho(relatorio.data === ontem)}>Ontem</button>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><dt className="text-sm font-bold text-slate-600">Horas paradas</dt><dd className="text-2xl font-black tabular-nums text-slate-950">{formatarMinutos(relatorio.totalMin)}</dd></div>
          <div><dt className="text-sm font-bold text-slate-600">Equipamentos</dt><dd className="text-2xl font-black tabular-nums text-slate-950">{relatorio.equipamentos}</dd></div>
          <div><dt className="text-sm font-bold text-slate-600">Em conferência</dt><dd className="text-2xl font-black tabular-nums text-slate-950">{relatorio.emConferencia}</dd></div>
          <div><dt className="text-sm font-bold text-slate-600">Conferidos</dt><dd className="text-2xl font-black tabular-nums text-slate-950">{relatorio.conferidos} de {relatorio.equipamentos}</dd></div>
        </dl>
        <p className={`rounded-xl px-3 py-2 text-sm font-semibold lg:col-span-2 ${relatorio.fechado ? 'bg-emerald-50 text-emerald-900' : 'bg-[#f7f8f6] text-slate-700'}`} aria-live="polite">{pendencia}</p>
      </section>

      <div className="flex min-h-[22rem] flex-col">
        <TabelaPadrao
          titulo={`Horas paradas de ${dataBr(relatorio.data)}`}
          linhas={relatorio.linhas}
          colunas={colunas}
          idDaLinha={linha => linha.registroId}
          nomeDoItem={{ um: 'equipamento', varios: 'equipamentos' }}
          testIdLinha="relatorio-manutencao-linha"
          resumo={<span className="tabular-nums"> · {formatarMinutos(relatorio.totalMin)} paradas · {relatorio.conferidos} de {relatorio.equipamentos} conferidos</span>}
          vazio={<EmptyState icon={ClipboardList} title={`Nenhuma parada em ${dataBr(relatorio.data)}`} description="Nenhum equipamento entrou em manutenção neste dia." />}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section data-manutencao-reveal aria-labelledby="relatorio-tipo-titulo" className={`${CARTAO} p-4`}>
          <h2 id="relatorio-tipo-titulo" className="text-base font-black text-slate-900">Por tipo de equipamento</h2>
          {relatorio.porTipo.length === 0
            ? <p className="mt-2 text-sm text-slate-600">Sem paradas neste dia.</p>
            : (
              <ul className="mt-3 space-y-3">
                {relatorio.porTipo.map(item => (
                  <li key={item.tipo}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-bold text-slate-700">{item.tipo} <span className="font-semibold text-[#5b6870]">· {item.equipamentos}</span></span>
                      <strong className="shrink-0 tabular-nums text-slate-950">{formatarMinutos(item.totalMin)}</strong>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#176b4d]" style={{ width: `${Math.max(3, (item.totalMin / maiorTipo) * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section data-manutencao-reveal aria-labelledby="relatorio-motivos-titulo" className={`${CARTAO} p-4`}>
          <h2 id="relatorio-motivos-titulo" className="flex items-center gap-2 text-base font-black text-slate-900"><BarChart3 className="size-4 text-[#176b4d]" aria-hidden="true" /> Motivos que mais pararam</h2>
          {motivos.length === 0
            ? <p className="mt-2 text-sm text-slate-600">Sem paradas neste dia.</p>
            : (
              <ul className="mt-3 space-y-3">
                {motivos.slice(0, 8).map(item => (
                  <li key={item.motivo}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-bold text-slate-700" title={item.motivo}>{item.motivo} <span className="font-semibold text-[#5b6870]">· {item.equipamentos}</span></span>
                      <strong className="shrink-0 tabular-nums text-slate-950">{formatarMinutos(item.totalMin)}</strong>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#f26a2e]" style={{ width: `${Math.max(3, (item.totalMin / maiorMotivo) * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>
    </>
  );
}
