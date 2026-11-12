import { Check, ChevronRight, Package, UserRound } from "lucide-react";
import { CARTAO } from "../cadastros/estilos";
import {
  PASSOS_RASTREIO,
  rastreioDe,
  situacaoDe,
  type Solicitacao,
} from "../../utils/solicitacoes";
import { SeloSituacao } from "./SeloSituacao";

interface Props {
  sol: Solicitacao;
  hoje: string;
  ativo: boolean;
  onAbrir: () => void;
}

const ETAPA_CURTA = ["Pedido", "Compras", "Aprovação", "A caminho", "Entregue"];

function textoItem(sol: Solicitacao) {
  const primeiro = sol.itens[0];
  if (!primeiro) return "Nenhum item informado";
  const extras = sol.itens.length - 1;
  return `${primeiro.descricao}${extras > 0 ? ` e mais ${extras} item(ns)` : ""}`;
}

function classeEtapa(indice: number, passo: number, parado: boolean) {
  if (indice < passo || passo === 4) return "bg-[#176b4d] text-white";
  if (indice === passo)
    return parado ? "bg-rose-600 text-white" : "bg-[#c2410c] text-white";
  return "bg-slate-200 text-slate-500";
}

function textoStatus(sol: Solicitacao, hoje: string) {
  const rastreio = rastreioDe(sol, hoje);
  if (rastreio.tom === "atraso") return "Atenção: prazo ultrapassado";
  if (rastreio.tom === "falta") return "Entrega parcial ou pendente";
  if (rastreio.tom === "fechado") return "Pedido concluído";
  if (rastreio.tom === "cancelado") return "Pedido cancelado";
  return rastreio.frase;
}

export function CartaoCompraCompacto({ sol, hoje, ativo, onAbrir }: Props) {
  const rastreio = rastreioDe(sol, hoje);
  const situacao = situacaoDe(sol, hoje);
  const parado = rastreio.tom === "atraso" || rastreio.tom === "falta";
  const cancelado = rastreio.tom === "cancelado";
  const quantidadeTotal = sol.itens.reduce(
    (total, item) => total + item.quantidade,
    0,
  );
  const quantidadeRecebida = sol.itens.reduce(
    (total, item) => total + (item.quantidadeRecebida ?? 0),
    0,
  );
  const percentual =
    quantidadeTotal > 0
      ? Math.min(100, Math.round((quantidadeRecebida / quantidadeTotal) * 100))
      : 0;
  const destaque = parado
    ? "border-rose-300"
    : ativo
      ? "border-[#176b4d]"
      : "border-slate-200";

  return (
    <li data-testid="pedido-card" className="min-w-0">
      <button
        type="button"
        onClick={onAbrir}
        aria-current={ativo || undefined}
        className={`${CARTAO} group grid h-full w-full min-w-0 content-start gap-3 p-3 text-left transition hover:-translate-y-px hover:border-[#176b4d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus) ${destaque}`}
      >
        <span className="flex min-w-0 items-start justify-between gap-3">
          <span className="flex min-w-0 items-start gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-[#176b4d]">
              <Package className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-base font-black text-slate-900">
                {sol.numero}
              </strong>
              <span className="flex min-w-0 items-center gap-1 text-sm text-slate-600">
                <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{sol.solicitante}</span>
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <SeloSituacao situacao={situacao} />
            <ChevronRight
              className="size-4 text-slate-500 transition group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </span>

        <span className="grid gap-1">
          <span className="truncate text-sm font-bold text-slate-800">
            {textoItem(sol)}
          </span>
          <span className="truncate text-xs text-slate-500">
            {[
              sol.frente,
              sol.estacamento,
              sol.numeroSc ? `SC ${sol.numeroSc}` : "",
            ]
              .filter(Boolean)
              .join(" · ") || "Solicitação de compra"}
          </span>
        </span>

        {!cancelado && (
          <span
            className="grid grid-cols-5 pt-1"
            aria-label={`Etapa atual: ${PASSOS_RASTREIO[rastreio.passo]}`}
          >
            {ETAPA_CURTA.map((nome, indice) => {
              const feito = indice < rastreio.passo || rastreio.passo === 4;
              const atual = indice === rastreio.passo && rastreio.passo !== 4;
              return (
                <span
                  key={nome}
                  className="relative flex min-w-0 flex-col items-center gap-1"
                >
                  {indice > 0 && (
                    <span
                      aria-hidden="true"
                      className={`absolute right-1/2 top-3 h-0.5 w-full ${indice <= rastreio.passo ? "bg-[#176b4d]" : "bg-slate-200"}`}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={`relative z-10 grid size-6 place-items-center rounded-full text-xs font-black ${classeEtapa(indice, rastreio.passo, parado)}`}
                  >
                    {feito ? <Check className="size-3.5" /> : indice + 1}
                  </span>
                  <span
                    className={`max-w-full truncate px-0.5 text-xs ${atual ? "font-bold text-slate-900" : "text-slate-600"}`}
                  >
                    {nome}
                  </span>
                </span>
              );
            })}
          </span>
        )}

        <span className="grid gap-2 border-t border-slate-100 pt-2">
          <span
            className={`truncate text-sm ${parado ? "font-bold text-rose-700" : "text-slate-700"}`}
          >
            {textoStatus(sol, hoje)}
          </span>
          <span className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {sol.itens.length} item(ns) · {sol.itens[0]?.unidade ?? "un."}
            </span>
            <span className="font-bold text-slate-700">
              {percentual}% recebido
            </span>
          </span>
          <span
            className="h-1.5 overflow-hidden rounded-full bg-slate-100"
            aria-hidden="true"
          >
            <span
              className="block h-full rounded-full bg-[#176b4d]"
              style={{ width: `${percentual}%` }}
            />
          </span>
        </span>

        <span className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {sol.janelaFim
              ? `Entrega até ${sol.janelaFim.split("-").reverse().join("/")}`
              : "Prazo não informado"}
          </span>
          {sol.prioridade !== undefined &&
            sol.etapa !== "Entregue" &&
            sol.etapa !== "Cancelado" && (
              <span className="rounded-full bg-orange-50 px-2 py-0.5 font-bold text-[#c2410c]">
                Prioridade {sol.prioridade}º
              </span>
            )}
        </span>
      </button>
    </li>
  );
}
