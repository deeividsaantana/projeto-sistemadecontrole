/**
 * Manutenção › Hoje: quatro números do dia e um cartão por equipamento que
 * parou hoje. "Liberar agora" e "Entrou em manutenção" gravam pelo mesmo
 * caminho do Quadro da Frota (registroDaEdicao), para a OS automática e os
 * eventos do dia saírem iguais venha de onde vier o lançamento.
 */
import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Timer, Truck, Wrench, type LucideIcon } from 'lucide-react';
import type { ControleEquipamentoDiario, Equipamento, Funcionario, StatusControleEquipamentoDiario } from '../../types';
import type { FleetPersistedRecord } from '../../fleet/domain';
import { registroDaEdicao } from '../../modules/frota/quadroFrota';
import { formatarMinutos, horaLocal, horasParadasDoDia } from '../../utils/horasParadasDoDia';
import { continuarAlemDoLimite, vemParadoDeOntem, voltarARegraDasDezHoras } from '../../utils/manutencaoLimite';
import type { RelatorioManutencaoDia } from '../../utils/relatorioManutencaoDia';
import { CartaoIndicador, EmptyState, GradeIndicadores } from '../../shared/ui';
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
  /** Grava decisão sobre o dia (mesmo caminho da Conferência, que refaz a OS). */
  onSalvarConferencia?: (registro: ControleEquipamentoDiario, descricao: string) => void;
}

interface Contador { id: string; rotulo: string; valor: string; detalhe: string; Icone: LucideIcon; destaque?: 'rose' | 'amber'; aoClicar?: () => void }

export function ManutencaoHoje({ relatorio, registros, equipamentos, motoristas, responsavel, podeEditar, agora, paraConferir, onAbrirConferencia, onSaveControle, onSalvarConferencia }: Props) {
  const registroPorId = useMemo(() => new Map(registros.map(registro => [registro.id, registro])), [registros]);
  const linhas = useMemo(() => [...relatorio.linhas].sort((a, b) => {
    const peso = (linha: typeof a) => (linha.parada.periodos.some(periodo => periodo.fim === null) ? 0 : linha.grupo === 'OK' ? 2 : 1);
    return peso(a) - peso(b) || a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true });
  }), [relatorio.linhas]);

  const paradosAgora = relatorio.linhas.filter(linha => linha.parada.periodos.some(periodo => periodo.fim === null)).length;
  const liberados = relatorio.linhas.filter(linha => linha.parada.situacao === 'LIBERADO').length;
  const contadores: Contador[] = [
    { id: 'parados', rotulo: 'Parados agora', valor: String(paradosAgora), detalhe: paradosAgora === 1 ? 'equipamento na oficina' : 'equipamentos na oficina', Icone: Truck, destaque: paradosAgora > 0 ? 'rose' : undefined },
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
      <GradeIndicadores rotulo="Números de hoje">
        {contadores.map(item => (
          <CartaoIndicador
            key={item.id}
            dados={{ 'data-manutencao-reveal': true, 'data-testid': `manutencao-contador-${item.id}` }}
            rotulo={item.rotulo}
            valor={item.valor}
            detalhe={item.detalhe}
            icone={item.Icone}
            tom={item.destaque === 'rose' ? 'vermelho' : item.destaque === 'amber' ? 'laranja' : 'neutro'}
            onClick={item.aoClicar}
          />
        ))}
      </GradeIndicadores>

      <section aria-labelledby="manutencao-hoje-titulo" className="mt-2">
        <div className="mb-2 flex flex-nowrap items-center justify-between gap-3 overflow-x-auto border-b border-slate-100 pb-2">
          <div className="min-w-0 flex-1">
            <h2 id="manutencao-hoje-titulo" className="text-lg font-bold text-slate-900">Equipamentos que pararam hoje</h2>
            <p className="truncate text-sm text-slate-600">Primeiro os que ainda estão na oficina. A conta para em 10 h por dia, salvo quem segue além.</p>
          </div>
          <span className="flex-none text-xs font-semibold tabular-nums text-slate-500">Atualizado às {horaAgora}</span>
        </div>
        {linhas.length === 0
          ? <EmptyState icon={CheckCircle2} title="Nenhum equipamento parou hoje" description="Quando alguém lançar uma entrada em manutenção, aqui ou no Quadro da Frota, o equipamento aparece neste quadro." />
          : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                    onContinuarAlem={onSalvarConferencia ? () => onSalvarConferencia(continuarAlemDoLimite(registro, responsavel, new Date().toISOString()), `Manutenção: ${registro.prefixo} segue além de 10 h até a liberação.`) : undefined}
                    onVoltarRegra={onSalvarConferencia ? () => onSalvarConferencia(voltarARegraDasDezHoras(registro, responsavel, new Date().toISOString()), `Manutenção: ${registro.prefixo} voltou à regra das 10 h.`) : undefined}
                  />
                );
              })}
            </div>
          )}
      </section>
    </>
  );
}
