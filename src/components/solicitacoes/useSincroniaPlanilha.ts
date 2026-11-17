/**
 * Site ↔ planilha de compras (Google Planilhas), nos dois sentidos.
 *
 * Ao abrir a aba: o servidor relê a planilha (se a última leitura passou de
 * 2 min), o que mudou lá vira card novo ou registro na linha do tempo, e o que
 * mudou no site vai para a planilha. Depois de cada ação no site, só aquele
 * pedido é enviado. As regras de quem vale moram em `sincronizarComPlanilha`.
 */
import { useEffect, useRef } from 'react';
import type { ProcurementSheetRow } from '../../services/procurementSheetApi';
import type { Solicitacao } from '../../utils/solicitacoes';
import {
  QUEM_SINCRONIZA,
  comBaseDaPlanilha,
  sincronizarComPlanilha,
  type EnvioParaPlanilha,
} from '../../utils/solicitacoesPlanilha';

interface Opcoes {
  solicitacoes: Solicitacao[];
  /** Quem pode trazer pedidos da planilha (e, por isso, sincronizar ao abrir). */
  ligado: boolean;
  onSalvar: (registros: Solicitacao[], descricao: string) => void;
  avisar: (tom: 'ok' | 'erro', texto: string) => void;
}

const servico = () => import('../../services/procurementSheetApi');

export function useSincroniaPlanilha({ solicitacoes, ligado, onSalvar, avisar }: Opcoes) {
  const espelho = useRef<ProcurementSheetRow[] | null>(null);
  const escrita = useRef(false);
  const enviando = useRef(false);
  const fila = useRef<{ envios: EnvioParaPlanilha[]; conhecidas: Solicitacao[] }[]>([]);
  const atuais = useRef(solicitacoes);
  atuais.current = solicitacoes;

  const enviar = async (envios: EnvioParaPlanilha[], conhecidas: Solicitacao[]) => {
    if (!envios.length || !escrita.current) return;
    // Um envio por vez; o que chega no meio vai logo depois.
    if (enviando.current) { fila.current.push({ envios, conhecidas }); return; }
    enviando.current = true;
    try {
      const { sendToProcurementSheet } = await servico();
      const resposta = await sendToProcurementSheet(envios.flatMap(envio => envio.linhas));
      espelho.current = resposta.rows;
      // A versão mais nova de cada card (a pessoa pode ter mexido enquanto enviava).
      const porId = new Map([...conhecidas, ...atuais.current].map(sol => [sol.id, sol]));
      const agora = new Date().toISOString();
      const gravar = envios.flatMap(envio => {
        const sol = porId.get(envio.solId);
        if (!sol) return [];
        const pedido = resposta.pedidos[sol.numero];
        const evento = { data: agora, usuario: QUEM_SINCRONIZA, acao: 'Lançado na planilha de compras', ...(pedido ? { detalhe: `N° do pedido ${pedido}` } : {}) };
        return [{ ...sol, planilha: envio.estado, ...(envio.nova ? { eventos: [...sol.eventos, evento] } : {}), atualizadoEm: agora }];
      });
      const novas = envios.filter(envio => envio.nova).length;
      if (gravar.length) onSalvar(gravar, novas ? `Planilha de compras: ${novas} pedido(s) lançado(s).` : 'Planilha de compras atualizada.');
    } catch (erro) {
      avisar('erro', `A planilha de compras não recebeu a mudança agora; o site tenta de novo na próxima vez. ${erro instanceof Error ? erro.message : ''}`.trim());
    } finally {
      enviando.current = false;
      const proximos = fila.current.splice(0);
      if (proximos.length) void enviar(proximos.flatMap(item => item.envios), proximos.flatMap(item => item.conhecidas));
    }
  };

  // Uma vez por abertura da aba, quando os pedidos da nuvem já chegaram (para não sobrescrever).
  const sincronizou = useRef(false);
  const temPedidos = solicitacoes.length > 0;
  useEffect(() => {
    if (sincronizou.current || !temPedidos || !ligado) return;
    sincronizou.current = true;
    servico()
      .then(({ loadProcurementSheet }) => loadProcurementSheet())
      .then(({ rows, escrita: podeEscrever }) => {
        espelho.current = rows;
        escrita.current = podeEscrever;
        if (!rows.length) return;
        const lida = rows.reduce((maior, row) => ((row.source_updated_at ?? '') > maior ? row.source_updated_at ?? '' : maior), '');
        const atual = atuais.current;
        const { novas, atualizadas, envios } = sincronizarComPlanilha(rows, atual, lida || new Date().toISOString());
        if (novas.length || atualizadas.length) {
          const partes = [novas.length ? `${novas.length} novo(s)` : '', atualizadas.length ? `${atualizadas.length} atualizado(s)` : ''].filter(Boolean).join(', ');
          onSalvar([...novas, ...atualizadas], `Planilha de compras: ${partes}.`);
          avisar('ok', `Planilha: ${partes}.`);
        }
        void enviar(envios, [...atual, ...atualizadas]);
      })
      // Sem rede ou sem a planilha: os pedidos seguem como estão.
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temPedidos, ligado]);

  /** Prepara o card para gravar (base da planilha) e, depois de gravar, manda a mudança para a planilha. */
  const depoisDeSalvar = (sol: Solicitacao) => {
    const rows = espelho.current;
    if (!rows) return sol;
    const pronto = comBaseDaPlanilha(sol, atuais.current, rows);
    const lista = [...atuais.current.filter(outra => outra.id !== pronto.id), pronto];
    const { envios } = sincronizarComPlanilha(rows, lista, new Date().toISOString());
    queueMicrotask(() => void enviar(envios.filter(envio => envio.solId === pronto.id), lista));
    return pronto;
  };

  return { depoisDeSalvar };
}
