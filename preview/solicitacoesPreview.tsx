/**
 * Solicitações no preview: dados de exemplo montados pelas próprias regras
 * (abrir, cotar, aprovar, receber), e a pessoa logada escolhida por ?como=
 * (Thiago, Cássia, Bruno, Almoxarife). As ações mudam o estado na hora.
 */
import { useState } from 'react';
import SolicitacoesTab from '../src/components/SolicitacoesTab';
import { PESSOAS_INICIAIS, abrirSolicitacao, aplicarAcao, type Ator, type Solicitacao } from '../src/utils/solicitacoes';
import { importarPlanilhaDeControle } from '../src/utils/solicitacoesPlanilha';

const pessoas = [...PESSOAS_INICIAIS, { id: 'sup-almox', nome: 'Almoxarife', papel: 'recebedor' as const, ativo: true }];
const ator = (nome: string): Ator => ({ nome, papel: pessoas.find(p => p.nome === nome)?.papel ?? null });
const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const quando = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const exemplo = (): Solicitacao[] => {
  const lista: Solicitacao[] = [];
  const abrir = (solicitante: string, frente: string, descricao: string, quantidade: number, unidade: string, n: number) => {
    const r = abrirSolicitacao({ solicitante, frente, estacamento: 'Estaca 1401+0,00', itens: [{ tipo: 'Material', descricao, quantidade, unidade, prazoDesejado: dias(n + 7), permiteParcial: true }] }, ator(solicitante), lista, quando(n), `ex-${lista.length}`);
    if ('solicitacao' in r) lista.push(r.solicitacao);
    return lista.length - 1;
  };
  const passo = (i: number, acao: Parameters<typeof aplicarAcao>[1], quem: string, n: number) => {
    const r = aplicarAcao(lista[i], acao, ator(quem), quando(n), lista);
    if ('solicitacao' in r) lista[i] = r.solicitacao;
  };
  const pedido = (fornecedor: string, valor: number, fim: number) => ({ fornecedor, valorTotal: valor, janelaInicio: dias(fim - 3), janelaFim: dias(fim), cotacoes: [{ fornecedor, valor }, { fornecedor: 'Concorrente S.A.', valor: valor * 1.08 }] });

  abrir('Thiago', 'Ramo 1400', 'Vergalhão CA-50 ø 12,5 mm', 10, 'ton', -1);
  const b = abrir('Alvaro', 'OAE Marginal', 'Tubo de concreto DN 800', 24, 'm', -4);
  passo(b, { tipo: 'assumir' }, 'Cássia', -4);
  const c = abrir('José Augusto', 'Ramo 200', 'CBUQ faixa C', 180, 'ton', -6);
  passo(c, { tipo: 'assumir' }, 'Sérgio', -6);
  passo(c, { tipo: 'enviarParaAprovacao', pedido: pedido('Usina Alto Tietê Ltda / 11.222.333/0001-44', 96500, 4) }, 'Sérgio', -5);
  const d = abrir('José Augusto Mineiro', 'Ramo 1400', 'Brita nº 1', 60, 'm³', -12);
  passo(d, { tipo: 'assumir' }, 'Cássia', -12);
  passo(d, { tipo: 'enviarParaAprovacao', pedido: pedido('Pedreira Itaquá / 22.333.444/0001-55', 8400, -2) }, 'Cássia', -11);
  passo(d, { tipo: 'aprovar' }, 'Bruno', -10);
  passo(d, { tipo: 'despachar' }, 'Cássia', -5);
  const e = abrir('Thiago', 'Bota-fora', 'Locação de caminhão basculante', 40, 'h', -15);
  passo(e, { tipo: 'assumir' }, 'Sérgio', -15);
  passo(e, { tipo: 'enviarParaAprovacao', pedido: pedido('Transportes Lara ME / 33.444.555/0001-66', 7200, -6) }, 'Sérgio', -14);
  passo(e, { tipo: 'aprovar' }, 'Bruno', -13);
  passo(e, { tipo: 'receber', recebimento: { tipo: 'Chegou ao Local de Descarte', local: 'Bota-Fora Lara', notaFiscal: '4512', quantidades: { 1: 40 } } }, 'Almoxarife', -7);
  // Pedidos trazidos da planilha de controle, com SC, prioridade e conferência.
  const linha = (n: number, pedidoN: number, quem: string, item: string, und: string, qtd: number, sc: string) =>
    ({ linha: n, valores: { Data: dias(-20), 'N° do pedido': pedidoN, Solicitante: quem, Item: item, Unidade: und, Quantidade: qtd, 'Solicitação de compra SC  (N°)': sc, 'previsão de entrega': dias(-2) } });
  const { novas } = importarPlanilhaDeControle([
    { nome: 'Solicitações', linhas: [
      linha(3, 101, 'Lucas', 'TUBOS DE PVC 400mm de 6m', 'Und.', 12, '93021654'),
      linha(4, 109, 'Carlos', 'MADEIRITE PLASTIFICADO 18mm', 'Und.', 30, '93041040'),
      linha(5, 109, 'Carlos', 'SARRAFO 10cm x 2,5cm x 3m', 'Und.', 80, '93041040'),
      linha(6, 109, 'Carlos', 'ESPUMA EXPANSIVA', 'Und.', 12, '93041040'),
    ] },
    { nome: 'Prioridade', linhas: [{ linha: 2, valores: { a: '1º', b: '', c: 101 } }] },
  ], lista, 'Cássia', quando(-1));
  lista.push(...novas);
  const i109 = lista.findIndex(sol => sol.id === 'controle-pedido-109');
  passo(i109, { tipo: 'receber', recebimento: { tipo: 'Chegou ao Local', local: 'Almoxarifado', notaFiscal: '88120', quantidades: { 1: 30, 2: 40 } } }, 'Almoxarife', -1);
  passo(i109, { tipo: 'apontarFalta', itemId: 3, observacao: 'não veio na carga de hoje' }, 'Almoxarife', -1);
  return lista;
};

export function SolicitacoesPreview() {
  const como = new URLSearchParams(location.search).get('como') || 'Cássia';
  const [lista, setLista] = useState(exemplo);
  const [equipe, setEquipe] = useState(pessoas);
  return (
    <SolicitacoesTab
      solicitacoes={lista}
      pessoas={equipe}
      usuario={{ nome: como }}
      ehAdmin
      podeEditar
      onSalvar={registros => setLista(atual => [...registros.filter(r => !atual.some(a => a.id === r.id)), ...atual.map(a => registros.find(r => r.id === a.id) ?? a)])}
      onSalvarPessoas={setEquipe}
    />
  );
}
