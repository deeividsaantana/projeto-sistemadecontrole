/**
 * Manutenção › Hoje: quatro números do dia e um cartão por equipamento que
 * parou hoje. "Liberar agora" e "Entrou em manutenção" gravam pelo mesmo
 * caminho do Quadro da Frota (registroDaEdicao), para a OS automática e os
 * eventos do dia saírem iguais venha de onde vier o lançamento.
 */
import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Timer, Wrench, type LucideIcon } from 'lucide-react';
import type { ControleEquipamentoDiario, Equipamento, Funcionario, StatusControleEquipamentoDiario } from '../../types';
import type { FleetPersistedRecord } from '../../fleet/domain';
import { registroDaEdicao } from '../../modules/frota/quadroFrota';
import { formatarMinutos, horaLocal, horasParadasDoDia } from '../../utils/horasParadasDoDia';
import { vemParadoDeOntem } from '../../utils/manutencaoLimite';
import type { RelatorioManutencaoDia } from '../../utils/relatorioManutencaoDia';
import { EmptyState } from '../../shared/ui';
import { CARTAO, FOCO } from '../cadastros/estilos';
import { CartaoParada } from './CartaoParada';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

interface Props {
  relatorio: RelatorioManutencaoDia;
  registros: readonly ControleEquipamentoDiario[];
  equipamentos: readonly Equipamento[];
  motoristas: readonly Funcionario[];
  responsavel: string;
  podeEditar: boolean;
  agora: Date;
  /** Equipamentos à espera de conferência, hoje e nos dias anteriores. */
  paraConferir: number;
  onAbrirConferencia: () => void;
  onSaveControle: (registro: ControleEquipamentoDiario) => void;
}

interface Contador { id: string; rotulo: string; valor: string; detalhe: string; Icone: LucideIcon; destaque?: 'rose' | 'amber'; aoClicar?: () => void }

export function ManutencaoHoje({ relatorio, registros, equipamentos, motoristas, responsavel, podeEditar, agora, paraConferir, onAbrirConferencia, onSaveControle }: Props) {
  const registroPorId = useMemo(() => new Map(registros.map(registro => [registro.id, registro])), [registros]);
  const linhas = useMemo(() => [...relatorio.linhas].sort((a, b) => {
    const peso = (linha: typeof a) => (linha.parada.periodos.some(periodo => periodo.fim === null) ? 0 : linha.grupo === 'OK' ? 2 : 1);
    return peso(a) - peso(b) || a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true });
  }), [relatorio.linhas]);

  const paradosAgora = relatorio.linhas.filter(linha => linha.parada.periodos.some(periodo => periodo.fim === null)).length;
  const liberados = relatorio.linhas.filter(linha => linha.parada.situacao === 'LIBERADO').length;
  const contadores: Contador[] = [
    { id: 'parados', rotulo: 'Parados agora', valor: String(paradosAgora), detalhe: paradosAgora === 1 ? 'equipamento na oficina' : 'equipamentos na oficina', Icone: Wrench, destaque: paradosAgora > 0 ? 'rose' : undefined },
    { id: 'horas', rotulo: 'Horas paradas hoje', valor: formatarMinutos(relatorio.totalMin), detalhe: 'já sem DDS e almoço', Icone: Timer },
    { id: 'conferir', rotulo: 'Para conferir', valor: String(paraConferir), detalhe: paraConferir > 0 ? 'toque para conferir' : 'nada pendente', Icone: AlertTriangle, destaque: paraConferir > 0 ? 'amber' : undefined, aoClicar: onAbrirConferencia },
    { id: 'liberados', rotulo: 'Liberados hoje', valor: String(liberados), detalhe: liberados === 1 ? 'voltou a trabalhar' : 'voltaram a trabalhar', Icone: CheckCircle2 },
  ];

  const lancar = (registro: ControleEquipamentoDiario, status: StatusControleEquipamentoDiario, hora: string, motivo: string): string | undefined => {
    if (!HORA.test(hora)) return 'Informe a hora, por exemplo 14:30.';
    const momento = new Date();
    if (registro.data === relatorio.data && hora > horaLocal(momento.toISOString())) return 'A hora não pode ser depois de agora.';
    const equipamento = equipamentos.find(item => item.id === registro.equipamentoId);
    if (!equipamento) return 'Esta máquina não está mais no cadastro.';
    const atual = registro as FleetPersistedRecord;
    const resultado = registroDaEdicao({
      dia: registro.data,
      hora,
      agora: momento.toISOString(),
      usuario: responsavel,
      equipamento,
      registros,
      funcionarios: motoristas,
      edicao: {
        status,
        canteiro: atual.local || '',
        frente: atual.frenteServico || '',
        operador: atual.nomeMotorista || '',
        motivoManutencao: motivo,
        observacao: atual.observacao || '',
      },
    });
    if ('erro' in resultado) return resultado.erro;
    // Não grava hora que deixaria o dia sem conta (liberação antes da entrada).
    const depois = horasParadasDoDia(resultado.registro, momento, { vemParadoDeOntem: vemParadoDeOntem(registros, resultado.registro) });
    if (depois.situacao === 'INCONSISTENTE') return `${depois.motivoInconsistencia || 'A hora não bate com o que já foi lançado.'} Confira a hora.`;
    onSaveControle(resultado.registro);
    return undefined;
  };

  const horaAgora = horaLocal(agora.toISOString());

  return (
    <>
      <section aria-label="Números de hoje" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {contadores.map(item => {
          const tom = item.destaque === 'amber' ? 'border-amber-300 bg-amber-50' : item.destaque === 'rose' ? 'border-rose-200 bg-white' : '';
          const conteudo = (
            <>
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-bold text-slate-600">{item.rotulo}</span>
                <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${item.destaque === 'amber' ? 'bg-amber-100 text-amber-900' : item.destaque === 'rose' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-[#176b4d]'}`}>
                  <item.Icone className="size-4" aria-hidden="true" />
                </span>
              </span>
              <strong className="mt-1 block text-2xl font-black leading-tight tabular-nums text-slate-950 sm:text-3xl">{item.valor}</strong>
              <span className="mt-0.5 block text-xs font-semibold text-[#5b6870]">{item.detalhe}</span>
            </>
          );
          const classe = `${CARTAO} ${tom} block min-w-0 p-4 text-left`;
          return item.aoClicar
            ? <button key={item.id} type="button" data-manutencao-reveal data-testid={`manutencao-contador-${item.id}`} onClick={item.aoClicar} className={`${classe} transition hover:-translate-y-0.5 hover:border-emerald-300 active:scale-[0.98] ${FOCO}`}>{conteudo}</button>
            : <div key={item.id} data-manutencao-reveal data-testid={`manutencao-contador-${item.id}`} className={classe}>{conteudo}</div>;
        })}
      </section>

      <section aria-labelledby="manutencao-hoje-titulo">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="manutencao-hoje-titulo" className="text-base font-black text-slate-900">Equipamentos que pararam hoje</h2>
            <p className="text-sm text-slate-600">Primeiro os que ainda estão na oficina. A conta para em 10 h por dia.</p>
          </div>
          <span className="text-sm font-bold tabular-nums text-slate-600">Atualizado às {horaAgora}</span>
        </div>
        {linhas.length === 0
          ? <EmptyState icon={CheckCircle2} title="Nenhum equipamento parou hoje" description="Quando alguém lançar uma entrada em manutenção, aqui ou no Quadro da Frota, o equipamento aparece neste quadro." />
          : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {linhas.map(linha => {
                const registro = registroPorId.get(linha.registroId);
                if (!registro) return null;
                return (
                  <CartaoParada
                    key={linha.registroId}
                    registro={registro}
                    parada={linha.parada}
                    ordemNumero={linha.ordemNumero}
                    tipo={linha.tipo}
                    podeEditar={podeEditar}
                    horaAgora={horaAgora}
                    onLiberar={hora => lancar(registro, 'Disponível', hora, registro.motivoManutencao || '')}
                    onEntrar={(hora, motivo) => lancar(registro, 'Em manutenção', hora, motivo)}
                  />
                );
              })}
            </div>
          )}
      </section>
    </>
  );
}
