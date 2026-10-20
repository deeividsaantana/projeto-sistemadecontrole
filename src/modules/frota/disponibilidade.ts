/**
 * Disponibilidade da frota: uma conta só para o Painel, o Quadro da Frota, o
 * Controle de Frotas e os relatórios (A19). Antes cada tela tinha a sua e o
 * mesmo dia aparecia com 92%, 70% e 55%.
 *
 * Disponível é a máquina lançada no dia que não está em manutenção, esteja
 * operando, à disposição, de reserva ou esperando motorista. Só situação
 * conhecida entra na conta: sem lançamento, A confirmar, Desmobilizado ou um
 * texto antigo que ninguém reconhece ficam de fora, para não inflar o número.
 * Sem nenhuma máquina na conta o resultado é null, e a tela mostra "—" em vez
 * de 0%.
 */
const EM_MANUTENCAO = new Set(['Em manutenção', 'Aguardando manutenção', 'Indisponível', 'Parado']);
const FORA_DA_MANUTENCAO = new Set([
  'Em operação', 'Disponível', 'À disposição', 'Liberado', 'Reserva', 'Aguardando motorista', 'Aguardando equipamento',
]);

export const disponibilidadeDaFrota = (situacoes: ReadonlyArray<string | undefined>): number | null => {
  let disponiveis = 0;
  let parados = 0;
  for (const situacao of situacoes) {
    const texto = (situacao ?? '').trim();
    if (FORA_DA_MANUTENCAO.has(texto)) disponiveis += 1;
    else if (EM_MANUTENCAO.has(texto)) parados += 1;
  }
  const contadas = disponiveis + parados;
  return contadas ? (disponiveis / contadas) * 100 : null;
};
