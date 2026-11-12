import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  ClipboardList,
  Download,
  FileJson,
  Filter,
  Layers,
  LayoutDashboard,
  Plus,
  Save,
  Send,
  Share2,
} from "lucide-react";
import type { PlanejamentoItem, RegistroProducao, ServicoObra } from "../types";
import {
  CAMPO,
  CARTAO,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
} from "./cadastros/estilos";
import { TabelaPadrao, type ColunaTabela } from "../shared/ui/TabelaPadrao";
import { PageHeader } from "../shared/ui/PageHeader";
import { TelaCheia } from "../shared/ui/TelaCheia";
import { AbasDaTela } from "../shared/ui/AbasDaTela";

interface Props {
  planejamento: PlanejamentoItem[];
  producao: RegistroProducao[];
  servicos: ServicoObra[];
  responsavel: string;
  podeEditar: boolean;
  onSavePlanejamento: (item: PlanejamentoItem, isNew: boolean) => void;
  onSaveProducao: (item: RegistroProducao, isNew: boolean) => void;
}

const hoje = () => new Date().toISOString().slice(0, 10);

export default function ProgramacaoTerraplanagemTab({
  planejamento,
  producao,
  servicos,
  responsavel,
  podeEditar,
  onSavePlanejamento,
  onSaveProducao,
}: Props) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("todos");
  const [visao, setVisao] = useState<
    "campo" | "painel" | "programacao" | "producao" | "analise"
  >("programacao");
  const [frente, setFrente] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [encarregado, setEncarregado] = useState("");
  const [dataSelecionada, setDataSelecionada] = useState(hoje());
  const [quantidadesHoje, setQuantidadesHoje] = useState<
    Record<string, string>
  >({});
  const [simItemId, setSimItemId] = useState("");
  const [simMeta, setSimMeta] = useState("");
  const [simFim, setSimFim] = useState("");
  const [semDomingo, setSemDomingo] = useState(false);
  const [simMensagem, setSimMensagem] = useState("");
  const [form, setForm] = useState({
    servicoId: servicos[0]?.id || "",
    inicio: hoje(),
    fim: hoje(),
    quantidade: "",
    frente: "",
  });
  const [producaoForm, setProducaoForm] = useState({
    itemId: "",
    quantidade: "",
    frente: "",
    observacao: "",
  });
  const frentes = useMemo(
    () =>
      [
        ...new Set(
          planejamento
            .map((item) => item.frente)
            .filter((item): item is string => Boolean(item)),
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [planejamento],
  );
  const encarregados = useMemo(
    () =>
      [
        ...new Set(
          planejamento
            .map((item) => item.responsavel || item.equipeNome)
            .filter(Boolean) as string[],
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [planejamento],
  );
  const dias = useMemo(
    () =>
      Array.from({ length: 7 }, (_, offset) => {
        const date = new Date(`${dataSelecionada}T12:00:00`);
        date.setDate(date.getDate() + offset);
        return date.toISOString().slice(0, 10);
      }),
    [dataSelecionada],
  );
  const ativos = useMemo(
    () =>
      planejamento.filter(
        (item) =>
          item.ativo !== false &&
          (status === "todos" || item.situacao === status) &&
          (!frente || item.frente === frente) &&
          (!encarregado ||
            (item.responsavel || item.equipeNome) === encarregado) &&
          (!dataInicio || item.dataFim >= dataInicio) &&
          (!dataFim || item.dataInicio <= dataFim) &&
          item.dataInicio <= dataSelecionada &&
          item.dataFim >= dataSelecionada &&
          `${item.servicoDescricao} ${item.frente || ""} ${item.responsavel || ""}`
            .toLocaleLowerCase()
            .includes(busca.toLocaleLowerCase()),
      ),
    [
      planejamento,
      status,
      busca,
      frente,
      encarregado,
      dataInicio,
      dataFim,
      dataSelecionada,
    ],
  );
  const atualizar = (campo: keyof typeof form, valor: string) =>
    setForm((atual) => ({ ...atual, [campo]: valor }));
  const salvarPlano = () => {
    const servico = servicos.find((item) => item.id === form.servicoId);
    const qtd = Number(form.quantidade);
    if (!servico || !form.inicio || !form.fim || !(qtd > 0)) return;
    const agora = new Date().toISOString();
    onSavePlanejamento(
      {
        id: `plano-${Date.now()}`,
        dataInicio: form.inicio,
        dataFim: form.fim,
        servicoId: servico.id,
        servicoDescricao: servico.descricao,
        unidade: servico.unidade,
        quantidadePlanejada: qtd,
        frente: form.frente.trim() || undefined,
        responsavel,
        situacao: "Planejado",
        ativo: true,
        criadoEm: agora,
        atualizadoEm: agora,
      },
      true,
    );
    setForm((atual) => ({ ...atual, quantidade: "", frente: "" }));
  };
  const salvarProducao = () => {
    const plano = planejamento.find((item) => item.id === producaoForm.itemId);
    const qtd = Number(producaoForm.quantidade);
    if (!plano || !(qtd > 0)) return;
    const agora = new Date().toISOString();
    onSaveProducao(
      {
        id: `producao-${Date.now()}`,
        data: hoje(),
        servicoId: plano.servicoId,
        servicoDescricao: plano.servicoDescricao,
        unidade: plano.unidade,
        quantidade: qtd,
        frente: producaoForm.frente.trim() || plano.frente,
        observacao: producaoForm.observacao.trim() || undefined,
        responsavel,
        ativo: true,
        criadoEm: agora,
        atualizadoEm: agora,
      },
      true,
    );
    setProducaoForm({ itemId: "", quantidade: "", frente: "", observacao: "" });
  };
  const lancarNoCard = (item: PlanejamentoItem) => {
    const qtd = Number(quantidadesHoje[item.id]);
    if (!(qtd > 0)) return;
    const agora = new Date().toISOString();
    onSaveProducao(
      {
        id: `producao-${Date.now()}`,
        data: dataSelecionada,
        servicoId: item.servicoId,
        servicoDescricao: item.servicoDescricao,
        unidade: item.unidade,
        quantidade: qtd,
        frente: item.frente,
        responsavel,
        ativo: true,
        criadoEm: agora,
        atualizadoEm: agora,
      },
      true,
    );
    setQuantidadesHoje((atual) => ({ ...atual, [item.id]: "" }));
  };
  const formatarDia = (valor: string, completo = false) =>
    new Intl.DateTimeFormat(
      "pt-BR",
      completo
        ? { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }
        : { weekday: "short", day: "2-digit", month: "2-digit" },
    ).format(new Date(`${valor}T12:00:00`));
  const totalDoItem = (item: PlanejamentoItem) =>
    producao
      .filter(
        (reg) =>
          reg.servicoId === item.servicoId &&
          reg.data >= item.dataInicio &&
          reg.data <= item.dataFim &&
          reg.ativo !== false,
      )
      .reduce((total, reg) => total + reg.quantidade, 0);
  const metaDoDia = (item: PlanejamentoItem) => {
    const metaRegistrada = item.observacao?.match(
      /Meta diária:\s*([\d.,]+)/i,
    )?.[1];
    if (metaRegistrada) return Number(metaRegistrada.replace(",", "."));
    const diasPlanejados = Math.max(
      1,
      Math.round(
        (new Date(`${item.dataFim}T12:00:00`).getTime() -
          new Date(`${item.dataInicio}T12:00:00`).getTime()) /
          86400000,
      ) + 1,
    );
    return Math.ceil(item.quantidadePlanejada / diasPlanejados);
  };
  const adicionarDias = (valor: string, quantidade: number) => {
    const data = new Date(`${valor}T12:00:00`);
    data.setDate(data.getDate() + quantidade);
    return data.toISOString().slice(0, 10);
  };
  const diasUteis = (inicio: string, fim: string, ignorarDomingo = false) => {
    if (!inicio || !fim || fim < inicio) return 0;
    let total = 0;
    for (let dia = inicio; dia <= fim; dia = adicionarDias(dia, 1)) {
      const semana = new Date(`${dia}T12:00:00`).getDay();
      if (!ignorarDomingo || semana !== 0) total += 1;
    }
    return total;
  };
  const simItem =
    planejamento.find((item) => item.id === simItemId) ?? planejamento[0];
  const simRealizado = simItem ? totalDoItem(simItem) : 0;
  const simSaldo = simItem
    ? Math.max(0, simItem.quantidadePlanejada - simRealizado)
    : 0;
  const simDias = simItem
    ? diasUteis(simItem.dataInicio, simItem.dataFim, semDomingo)
    : 0;
  const simMetaCalculada =
    Number(simMeta) > 0 ? Number(simMeta) : simItem ? metaDoDia(simItem) : 0;
  const simFimCalculado =
    simItem && simMetaCalculada > 0
      ? adicionarDias(
          dataSelecionada,
          Math.max(0, Math.ceil(simSaldo / simMetaCalculada) - 1),
        )
      : "";
  const semanaProgramacao = useMemo(
    () =>
      Array.from({ length: 7 }, (_, offset) =>
        adicionarDias(dataSelecionada, offset),
      ),
    [dataSelecionada],
  );
  const itensDoDia = (dia: string) =>
    planejamento.filter(
      (item) =>
        item.ativo !== false &&
        item.dataInicio <= dia &&
        item.dataFim >= dia &&
        (!semDomingo || new Date(`${dia}T12:00:00`).getDay() !== 0),
    );
  const colunas: ColunaTabela<PlanejamentoItem & { realizado: number }>[] = [
    {
      chave: "servico",
      titulo: "Serviço",
      render: (item) => (
        <span className="font-bold">{item.servicoDescricao}</span>
      ),
      valorOrdenacao: (item) => item.servicoDescricao,
    },
    {
      chave: "frente",
      titulo: "Frente",
      render: (item) => item.frente || "—",
      valorOrdenacao: (item) => item.frente || "",
    },
    {
      chave: "periodo",
      titulo: "Período",
      render: (item) => (
        <span className="whitespace-nowrap">
          {item.dataInicio} → {item.dataFim}
        </span>
      ),
      valorOrdenacao: (item) => item.dataInicio,
    },
    {
      chave: "planejado",
      titulo: "Planejado",
      alinhamento: "direita",
      render: (item) => `${item.quantidadePlanejada} ${item.unidade}`,
      valorOrdenacao: (item) => item.quantidadePlanejada,
    },
    {
      chave: "realizado",
      titulo: "Realizado",
      alinhamento: "direita",
      render: (item) => (
        <span className="font-bold text-emerald-700">
          {item.realizado} {item.unidade}
        </span>
      ),
      valorOrdenacao: (item) => item.realizado,
    },
    {
      chave: "situacao",
      titulo: "Situação",
      render: (item) => item.situacao,
      valorOrdenacao: (item) => item.situacao,
    },
  ];
  const linhas = ativos.map((item) => ({
    ...item,
    realizado: producao
      .filter(
        (reg) =>
          reg.servicoId === item.servicoId &&
          reg.data >= item.dataInicio &&
          reg.data <= item.dataFim &&
          reg.ativo !== false,
      )
      .reduce((total, reg) => total + reg.quantidade, 0),
  }));
  const linhasGantt = planejamento.filter(
    (item) =>
      item.ativo !== false &&
      (status === "todos" || item.situacao === status) &&
      (!frente || item.frente === frente) &&
      (!encarregado || (item.responsavel || item.equipeNome) === encarregado) &&
      `${item.servicoDescricao} ${item.frente || ""} ${item.responsavel || ""}`
        .toLocaleLowerCase()
        .includes(busca.toLocaleLowerCase()),
  );
  const inicioGantt = linhasGantt.reduce(
    (menor, item) => (item.dataInicio < menor ? item.dataInicio : menor),
    linhasGantt[0]?.dataInicio || dataSelecionada,
  );
  const fimGantt = linhasGantt.reduce(
    (maior, item) => (item.dataFim > maior ? item.dataFim : maior),
    linhasGantt[0]?.dataFim || dataSelecionada,
  );
  const intervaloGantt = Math.max(1, diasUteis(inicioGantt, fimGantt));
  const percentualGantt = (data: string) =>
    Math.max(
      0,
      Math.min(100, (diasUteis(inicioGantt, data) / intervaloGantt) * 100),
    );
  const larguraGantt = (inicio: string, fim: string) =>
    Math.max(2, percentualGantt(fim) - percentualGantt(inicio));
  const baixarArquivo = (
    nome: string,
    conteudo: string,
    tipo = "application/json",
  ) => {
    const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    link.click();
    URL.revokeObjectURL(url);
  };
  const copiarProgramacao = async (completa: boolean) => {
    const fonte = completa ? planejamento : ativos;
    const texto = fonte
      .map(
        (item) =>
          `${item.frente || "Sem frente"} | ${item.servicoDescricao} | ${item.responsavel || item.equipeNome || "Sem responsável"} | ${item.dataInicio} a ${item.dataFim} | Meta ${metaDoDia(item)} ${item.unidade}`,
      )
      .join("\n");
    await navigator.clipboard?.writeText(texto);
    setSimMensagem("Programação copiada.");
  };
  const aplicarSimulacao = () => {
    if (!podeEditar || !simItem || !(simMetaCalculada > 0) || !simFimCalculado)
      return;
    const agora = new Date().toISOString();
    onSavePlanejamento(
      {
        ...simItem,
        dataFim: simFim || simFimCalculado,
        observacao: `${simItem.observacao || ""}${simItem.observacao ? " · " : ""}Meta diária: ${simMetaCalculada} ${simItem.unidade}; simulação em ${agora.slice(0, 10)}`,
        atualizadoEm: agora,
      },
      false,
    );
    setSimMensagem(`Prazo atualizado para ${simFim || simFimCalculado}.`);
  };
  const linhasProducao = producao.filter(
    (item) =>
      item.ativo !== false &&
      (!frente || item.frente === frente) &&
      (!dataInicio || item.data >= dataInicio) &&
      (!dataFim || item.data <= dataFim) &&
      `${item.servicoDescricao} ${item.frente || ""}`
        .toLocaleLowerCase()
        .includes(busca.toLocaleLowerCase()),
  );
  const totalPlanejado = linhas.reduce(
    (total, item) => total + item.quantidadePlanejada,
    0,
  );
  const totalRealizado = linhas.reduce(
    (total, item) => total + item.realizado,
    0,
  );
  const percentual =
    totalPlanejado > 0
      ? Math.min(100, Math.round((totalRealizado / totalPlanejado) * 100))
      : 0;
  const limparFiltros = () => {
    setBusca("");
    setStatus("todos");
    setFrente("");
    setEncarregado("");
    setDataInicio("");
    setDataFim("");
  };
  const colunasProducao: ColunaTabela<RegistroProducao>[] = [
    {
      chave: "data",
      titulo: "Data",
      render: (item) => item.data,
      valorOrdenacao: (item) => item.data,
    },
    {
      chave: "servico",
      titulo: "Serviço",
      render: (item) => (
        <span className="font-bold">{item.servicoDescricao}</span>
      ),
      valorOrdenacao: (item) => item.servicoDescricao,
    },
    {
      chave: "frente",
      titulo: "Frente",
      render: (item) => item.frente || "—",
      valorOrdenacao: (item) => item.frente || "",
    },
    {
      chave: "quantidade",
      titulo: "Quantidade",
      alinhamento: "direita",
      render: (item) => `${item.quantidade} ${item.unidade}`,
      valorOrdenacao: (item) => item.quantidade,
    },
    {
      chave: "responsavel",
      titulo: "Responsável",
      render: (item) => item.responsavel,
      valorOrdenacao: (item) => item.responsavel,
    },
  ];
  const linhasSeteDias = semanaProgramacao.map((dia) => {
    const itens = itensDoDia(dia);
    return {
      id: dia,
      dia,
      servicos: itens.length,
      equipes:
        [
          ...new Set(
            itens
              .map((item) => item.responsavel || item.equipeNome)
              .filter(Boolean),
          ),
        ].join(", ") || "—",
      meta: itens.reduce((total, item) => total + metaDoDia(item), 0),
    };
  });
  const colunasSeteDias: ColunaTabela<(typeof linhasSeteDias)[number]>[] = [
    {
      chave: "dia",
      titulo: "Dia",
      render: (item) => (
        <span className="font-bold">{formatarDia(item.dia)}</span>
      ),
      valorOrdenacao: (item) => item.dia,
    },
    {
      chave: "servicos",
      titulo: "Serviços",
      alinhamento: "direita",
      render: (item) => item.servicos,
      valorOrdenacao: (item) => item.servicos,
    },
    {
      chave: "equipes",
      titulo: "Equipes",
      render: (item) => item.equipes,
      valorOrdenacao: (item) => item.equipes,
    },
    {
      chave: "meta",
      titulo: "Meta",
      alinhamento: "direita",
      render: (item) => (
        <span className="font-bold text-emerald-700">{item.meta}</span>
      ),
      valorOrdenacao: (item) => item.meta,
    },
  ];
  return (
    <TelaCheia
      id="programacao-tab"
      rotulo="Programação"
      longa
      rotuloDados="Programação e produção de terraplanagem"
      cabecalho={
        <PageHeader
          eyebrow="Operação"
          title="Programação"
          description="Planeje e lance a produção da obra em uma única linha de operação."
          abas={
            <AbasDaTela
              id="programacao-modos"
              rotulo="Modos da programação"
              ativa={visao}
              onTrocar={(id) => setVisao(id as typeof visao)}
              idPainel="programacao-conteudo"
              abas={[
                { id: "campo", rotulo: "Campo", icone: Share2 },
                { id: "painel", rotulo: "Painel", icone: LayoutDashboard },
                {
                  id: "programacao",
                  rotulo: "Programação",
                  icone: CalendarDays,
                },
                { id: "producao", rotulo: "Produção", icone: ClipboardList },
                { id: "analise", rotulo: "Análise", icone: BarChart3 },
              ]}
            />
          }
        />
      }
    >
      <section
        className="min-w-0 space-y-3"
        aria-label="Programação de terraplanagem"
      >
        {(visao === "programacao" || visao === "campo") && (
          <div className={`${CARTAO} space-y-3 p-3`}>
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setEncarregado("")}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-black ${!encarregado ? "border-[#176b4d] bg-[#176b4d] text-white" : "border-slate-200 bg-white text-slate-700"}`}
              >
                Todos
              </button>
              {encarregados.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setEncarregado(item)}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-black ${encarregado === item ? "border-[#176b4d] bg-[#176b4d] text-white" : "border-slate-200 bg-white text-slate-700"}`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="grid min-w-[38rem] grid-cols-7 gap-2 overflow-x-auto">
              {dias.map((dia, index) => (
                <button
                  type="button"
                  key={dia}
                  onClick={() => setDataSelecionada(dia)}
                  className={`rounded-lg border px-2 py-2 text-center ${dia === dataSelecionada ? "border-emerald-800 bg-[#172d43] text-white" : "border-slate-200 bg-white text-slate-700"}`}
                >
                  <span className="block text-xs font-bold uppercase">
                    {index === 0 ? "Hoje" : formatarDia(dia).split(",")[0]}
                  </span>
                  <strong className="block text-sm">
                    {dia.slice(8, 10)}/{dia.slice(5, 7)}
                  </strong>
                  <span
                    className={`block text-xs ${dia === dataSelecionada ? "text-emerald-300" : "text-emerald-700"}`}
                  >
                    {
                      planejamento.filter(
                        (item) =>
                          item.dataInicio <= dia &&
                          item.dataFim >= dia &&
                          item.ativo !== false,
                      ).length
                    }{" "}
                    serv.
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
              <input
                className={`${CAMPO} min-w-56 flex-1`}
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar serviço, frente ou encarregado"
                aria-label="Buscar programação"
              />
              <select
                className={`${CAMPO} w-40 shrink-0`}
                value={frente}
                onChange={(event) => setFrente(event.target.value)}
                aria-label="Filtrar frente"
              >
                <option value="">Todas as frentes</option>
                {frentes.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <select
                className={`${CAMPO} w-40 shrink-0`}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                aria-label="Filtrar situação"
              >
                <option value="todos">Todas as situações</option>
                <option>Planejado</option>
                <option>Em execução</option>
                <option>Concluído</option>
                <option>Cancelado</option>
              </select>
              <input
                className={`${CAMPO} w-36 shrink-0`}
                type="date"
                value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)}
                aria-label="Data inicial"
              />
              <input
                className={`${CAMPO} w-36 shrink-0`}
                type="date"
                value={dataFim}
                onChange={(event) => setDataFim(event.target.value)}
                aria-label="Data final"
              />
              {(busca ||
                frente ||
                dataInicio ||
                dataFim ||
                status !== "todos" ||
                encarregado) && (
                <button
                  type="button"
                  className={`${BOTAO_SECUNDARIO} shrink-0`}
                  onClick={limparFiltros}
                >
                  <Filter className="size-4" aria-hidden="true" /> Limpar
                </button>
              )}
              {podeEditar && (
                <button
                  type="button"
                  className={`${BOTAO_PRIMARIO} shrink-0`}
                  onClick={salvarPlano}
                >
                  <Plus className="size-4" aria-hidden="true" /> Novo plano
                </button>
              )}
            </div>
          </div>
        )}
        <div id="programacao-conteudo" role="tabpanel" className="space-y-3">
          {visao === "painel" && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  [
                    "Avanço físico global",
                    `${percentual}%`,
                    "realizado até a data",
                  ],
                  [
                    "Extensão prevista",
                    `${totalPlanejado} ${linhas[0]?.unidade || ""}`,
                    "serviços medidos",
                  ],
                  [
                    "Executado acumulado",
                    `${totalRealizado} ${linhas[0]?.unidade || ""}`,
                    "produção apontada",
                  ],
                  [
                    "Saldo a executar",
                    `${Math.max(0, totalPlanejado - totalRealizado)} ${linhas[0]?.unidade || ""}`,
                    "quantidade pendente",
                  ],
                  [
                    "Produção do dia",
                    `${producao.filter((item) => item.data === dataSelecionada).reduce((total, item) => total + item.quantidade, 0)} ${linhas[0]?.unidade || ""}`,
                    dataSelecionada,
                  ],
                  ["Serviços ativos", linhas.length, "no recorte atual"],
                ].map(([titulo, valor, detalhe]) => (
                  <article key={titulo} className={`${CARTAO} p-3`}>
                    <p className="text-xs font-bold text-slate-500">{titulo}</p>
                    <strong className="mt-1 block text-xl font-black text-slate-900">
                      {valor}
                    </strong>
                    <span className="text-xs text-slate-500">{detalhe}</span>
                  </article>
                ))}
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
                <article className={`${CARTAO} p-3`}>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-black">Curva de avanço físico</h2>
                    <span className="text-xs text-slate-500">
                      Previsto x realizado
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {[25, 40, 55, 70, 85, 100].map((marca, indice) => (
                      <div key={marca} className="flex items-center gap-2">
                        <span className="w-8 text-right text-xs text-slate-500">
                          {marca}%
                        </span>
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#176b4d]"
                            style={{
                              width: `${Math.min(percentual, marca + indice * 3)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
                <article className={`${CARTAO} p-3`}>
                  <h2 className="font-black">Gargalos e alertas</h2>
                  <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    {percentual >= 100
                      ? "Nenhum desvio relevante."
                      : "Acompanhe os serviços sem produção apontada."}
                  </p>
                </article>
              </div>
              <div className={`${CARTAO} p-3`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-black">Frentes de serviço</h2>
                  <span className="text-xs text-slate-500">
                    Avanço por ramo
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    ...new Set(
                      linhas.map((item) => item.frente || "Sem frente"),
                    ),
                  ].map((grupo) => {
                    const itensGrupo = linhas.filter(
                      (item) => (item.frente || "Sem frente") === grupo,
                    );
                    const previsto = itensGrupo.reduce(
                      (total, item) => total + item.quantidadePlanejada,
                      0,
                    );
                    const feito = itensGrupo.reduce(
                      (total, item) => total + item.realizado,
                      0,
                    );
                    const pct = previsto
                      ? Math.min(100, Math.round((feito / previsto) * 100))
                      : 0;
                    return (
                      <article
                        key={grupo}
                        className="rounded-lg border border-slate-200 p-3"
                      >
                        <p className="text-xs font-bold text-slate-500">
                          {grupo}
                        </p>
                        <strong className="block text-lg font-black text-slate-900">
                          {pct}%
                        </strong>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#176b4d]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-slate-600">
                          {itensGrupo.length} atividades
                        </p>
                      </article>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <article className={`${CARTAO} p-3`}>
                  <h2 className="font-black">Ordem do dia</h2>
                  <ul className="mt-2 divide-y divide-slate-100">
                    {linhas.slice(0, 10).map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          <strong>{item.servicoDescricao}</strong>
                          <span className="ml-2 text-xs text-slate-500">
                            {item.frente || "Sem frente"} ·{" "}
                            {item.responsavel ||
                              item.equipeNome ||
                              "sem responsável"}
                          </span>
                        </span>
                        <strong className="shrink-0 text-xs text-slate-700">
                          meta {metaDoDia(item)} {item.unidade}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </article>
                <article className={`${CARTAO} p-3`}>
                  <h2 className="font-black">Equipes</h2>
                  <ul className="mt-2 divide-y divide-slate-100">
                    {encarregados.map((nome) => {
                      const itensEquipe = linhas.filter(
                        (item) =>
                          (item.responsavel || item.equipeNome) === nome,
                      );
                      return (
                        <li
                          key={nome}
                          className="flex items-center justify-between gap-3 py-2 text-sm"
                        >
                          <span>
                            <strong>{nome}</strong>
                            <span className="ml-2 text-xs text-slate-500">
                              {itensEquipe.length} atividades
                            </span>
                          </span>
                          <span className="text-xs font-bold text-emerald-700">
                            Programada
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              </div>
            </div>
          )}
          {visao === "campo" && (
            <div className="space-y-3">
              <div
                className={`${CARTAO} flex flex-nowrap items-center gap-2 overflow-x-auto p-2`}
              >
                <button
                  type="button"
                  className={BOTAO_SECUNDARIO}
                  onClick={() => copiarProgramacao(false)}
                >
                  <Share2 className="size-4" aria-hidden="true" /> Enviar para a
                  equipe
                </button>
                <button
                  type="button"
                  className={BOTAO_SECUNDARIO}
                  onClick={() => window.print()}
                >
                  <Download className="size-4" aria-hidden="true" /> Imprimir
                  campo
                </button>
                <span className="text-xs text-slate-500">
                  {ativos.length} atividades no dia selecionado
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {ativos.map((item) => {
                  const realizado = totalDoItem(item);
                  const meta = metaDoDia(item);
                  const progresso = item.quantidadePlanejada
                    ? Math.min(
                        100,
                        Math.round(
                          (realizado / item.quantidadePlanejada) * 100,
                        ),
                      )
                    : 0;
                  return (
                    <article
                      key={item.id}
                      className={`${CARTAO} overflow-hidden`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="text-xs font-black uppercase text-slate-700">
                          {item.situacao}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {formatarDia(dataSelecionada)}
                        </span>
                      </div>
                      <div className="space-y-2 p-3">
                        <p className="text-xs font-bold uppercase text-emerald-700">
                          {item.frente || "Sem frente"}
                        </p>
                        <h2 className="text-lg font-black text-slate-900">
                          {item.servicoDescricao}
                        </h2>
                        <p className="text-xs text-slate-500">
                          {item.responsavel ||
                            item.equipeNome ||
                            "Equipe não definida"}{" "}
                          · {item.dataInicio} → {item.dataFim}
                        </p>
                        <div className="flex items-end gap-1">
                          <strong className="text-3xl font-black">
                            {meta}
                          </strong>
                          <span className="pb-1 text-xs font-bold text-slate-500">
                            {item.unidade} meta do dia
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#176b4d]"
                            style={{ width: `${progresso}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>
                            Realizado {realizado} {item.unidade}
                          </span>
                          <strong>{progresso}%</strong>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {ativos.length === 0 && (
                <div
                  className={`${CARTAO} p-8 text-center text-sm text-slate-500`}
                >
                  Nenhuma atividade para o dia selecionado.
                </div>
              )}
            </div>
          )}
          {visao === "painel" && (
            <div className="grid gap-3 lg:grid-cols-2">
              {[
                ...new Set(linhas.map((item) => item.frente || "Sem frente")),
              ].map((grupo) => {
                const grupoLinhas = linhas.filter(
                  (item) => (item.frente || "Sem frente") === grupo,
                );
                const previsto = grupoLinhas.reduce(
                  (total, item) => total + item.quantidadePlanejada,
                  0,
                );
                const feito = grupoLinhas.reduce(
                  (total, item) => total + item.realizado,
                  0,
                );
                const percentualGrupo =
                  previsto > 0
                    ? Math.min(100, Math.round((feito / previsto) * 100))
                    : 0;
                return (
                  <article key={grupo} className={`${CARTAO} p-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="flex items-center gap-2 font-black">
                        <Layers className="size-4 text-emerald-700" /> {grupo}
                      </h2>
                      <span className="text-xs font-bold text-slate-500">
                        {grupoLinhas.length} serviços
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#176b4d]"
                        style={{ width: `${percentualGrupo}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-slate-600">
                      <span>{feito} realizado</span>
                      <strong>{percentualGrupo}%</strong>
                      <span>{previsto} previsto</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {visao === "producao" && (
            <div className="space-y-3">
              <div className={`${CARTAO} grid gap-2 p-3 sm:grid-cols-4`}>
                <select
                  className={`${CAMPO} sm:col-span-2`}
                  value={producaoForm.itemId}
                  onChange={(event) =>
                    setProducaoForm((atual) => ({
                      ...atual,
                      itemId: event.target.value,
                    }))
                  }
                  aria-label="Frente e atividade"
                >
                  <option value="">Frente e atividade</option>
                  {planejamento.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.frente || "Sem frente"} · {item.servicoDescricao}
                    </option>
                  ))}
                </select>
                <input
                  className={CAMPO}
                  inputMode="decimal"
                  value={producaoForm.quantidade}
                  onChange={(event) =>
                    setProducaoForm((atual) => ({
                      ...atual,
                      quantidade: event.target.value,
                    }))
                  }
                  placeholder="Quantidade realizada"
                  aria-label="Quantidade realizada"
                />
                <input
                  className={CAMPO}
                  value={producaoForm.observacao}
                  onChange={(event) =>
                    setProducaoForm((atual) => ({
                      ...atual,
                      observacao: event.target.value,
                    }))
                  }
                  placeholder="Observação / equipamento"
                  aria-label="Observação da produção"
                />
                <button
                  type="button"
                  className={BOTAO_PRIMARIO}
                  onClick={salvarProducao}
                  disabled={!podeEditar}
                >
                  <Save className="size-4" aria-hidden="true" /> Registrar
                </button>
              </div>
              <div className={`${CARTAO} min-w-0`}>
                <TabelaPadrao
                  titulo="Controle por atividade"
                  linhas={linhasProducao}
                  colunas={colunasProducao}
                  idDaLinha={(item) => item.id}
                  nomeDoItem={{ um: "lançamento", varios: "lançamentos" }}
                  vazio="Nenhum lançamento no recorte."
                  densa
                  semPaginacao
                  exportar
                />
              </div>
            </div>
          )}
          {visao === "analise" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [
                  "Previsto x realizado por atividade",
                  `${totalRealizado} de ${totalPlanejado}`,
                ],
                ["Curva de avanço físico", `${percentual}% realizado`],
                ["Produção diária", `${linhasProducao.length} lançamentos`],
                [
                  "Produção acumulada",
                  `${totalRealizado} ${linhas[0]?.unidade || ""}`,
                ],
                [
                  "Por frente de serviço",
                  `${new Set(linhas.map((item) => item.frente).filter(Boolean)).size} frentes`,
                ],
                ["Por equipe", `${encarregados.length} encarregados`],
              ].map(([titulo, valor]) => (
                <article key={titulo} className={`${CARTAO} p-3`}>
                  <h2 className="font-black">{titulo}</h2>
                  <div className="mt-4 h-20 rounded-lg bg-slate-50 p-2">
                    <div className="flex h-full items-end gap-1">
                      {[18, 30, 24, 42, 35, percentual || 8].map(
                        (altura, indice) => (
                          <span
                            key={indice}
                            className="flex-1 rounded-t bg-[#176b4d]"
                            style={{ height: `${Math.min(100, altura)}%` }}
                          />
                        ),
                      )}
                    </div>
                  </div>
                  <strong className="mt-2 block text-lg font-black text-slate-900">
                    {valor}
                  </strong>
                  <p className="text-xs text-slate-500">
                    Dados do recorte selecionado
                  </p>
                </article>
              ))}
            </div>
          )}
          {visao === "programacao" && (
            <div className="space-y-3">
              <div className="flex flex-nowrap items-end justify-between gap-3 overflow-x-auto">
                <div className="shrink-0">
                  <p className="text-xs font-bold text-slate-500">
                    Serviços de{" "}
                    {dataSelecionada === hoje() ? "hoje" : "programação"}
                  </p>
                  <h2 className="text-xl font-black uppercase text-slate-900">
                    {formatarDia(dataSelecionada, true)}
                  </h2>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
                    {ativos.length} serviços
                  </span>
                  <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                    {ativos.length ? "Tudo em dia" : "Sem programação"}
                  </span>
                </div>
              </div>
              <div
                className={`${CARTAO} flex flex-nowrap items-center gap-2 overflow-x-auto p-2`}
              >
                <button
                  type="button"
                  className={BOTAO_SECUNDARIO}
                  onClick={() => copiarProgramacao(false)}
                >
                  <Send className="size-4" aria-hidden="true" /> Enviar para a
                  equipe
                </button>
                <button
                  type="button"
                  className={BOTAO_SECUNDARIO}
                  onClick={() => copiarProgramacao(false)}
                >
                  Copiar programação do dia
                </button>
                <button
                  type="button"
                  className={BOTAO_SECUNDARIO}
                  onClick={() => copiarProgramacao(true)}
                >
                  Copiar programação completa
                </button>
                <button
                  type="button"
                  className={BOTAO_SECUNDARIO}
                  onClick={() =>
                    baixarArquivo(
                      `programacao-${dataSelecionada}.json`,
                      JSON.stringify(
                        { referencia: dataSelecionada, planejamento, producao },
                        null,
                        2,
                      ),
                    )
                  }
                >
                  <FileJson className="size-4" aria-hidden="true" /> Backup JSON
                </button>
                <button
                  type="button"
                  className={BOTAO_SECUNDARIO}
                  onClick={() => window.print()}
                >
                  PDF / imprimir
                </button>
              </div>
              {ativos.length === 0 ? (
                <div
                  className={`${CARTAO} p-8 text-center text-sm text-slate-500`}
                >
                  Nenhuma atividade encontrada para este dia e filtros.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {ativos.map((item) => {
                    const realizado = totalDoItem(item);
                    const meta = metaDoDia(item);
                    const percentualItem =
                      meta > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (realizado / item.quantidadePlanejada) * 100,
                            ),
                          )
                        : 0;
                    return (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="bg-slate-100 px-3 py-2 text-xs font-black uppercase text-slate-700">
                          {item.situacao || "Programado"}
                        </div>
                        <div className="space-y-2 p-3">
                          <p className="truncate text-xs font-bold uppercase text-emerald-700">
                            {item.frente || "Sem frente"} ·{" "}
                            {item.responsavel ||
                              item.equipeNome ||
                              "Equipe não definida"}
                          </p>
                          <h3
                            className="truncate text-base font-black text-slate-900"
                            title={item.servicoDescricao}
                          >
                            {item.servicoDescricao}
                          </h3>
                          <p className="truncate font-mono text-xs text-slate-600">
                            {item.observacao ||
                              `Período ${item.dataInicio} → ${item.dataFim}`}
                          </p>
                          <div className="flex items-end gap-1 pt-1">
                            <span className="text-xs font-bold uppercase text-slate-500">
                              Meta de hoje
                            </span>
                            <strong className="text-3xl font-black leading-none text-slate-900">
                              {meta}
                            </strong>
                            <span className="pb-0.5 text-xs text-slate-600">
                              {item.unidade}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-[#176b4d]"
                              style={{ width: `${percentualItem}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-slate-600">
                            <span>
                              Feito {realizado} de {item.quantidadePlanejada}{" "}
                              {item.unidade}
                            </span>
                            <strong>{percentualItem}%</strong>
                          </div>
                          <div className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                            Termina em {item.dataFim}
                          </div>
                        </div>
                        {podeEditar && (
                          <form
                            className="flex gap-2 border-t border-slate-200 bg-slate-50 p-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              lancarNoCard(item);
                            }}
                          >
                            <input
                              className={`${CAMPO} min-w-0 flex-1`}
                              inputMode="decimal"
                              value={quantidadesHoje[item.id] || ""}
                              onChange={(event) =>
                                setQuantidadesHoje((atual) => ({
                                  ...atual,
                                  [item.id]: event.target.value,
                                }))
                              }
                              placeholder={`Feito hoje (${item.unidade})`}
                              aria-label={`Feito hoje ${item.servicoDescricao}`}
                            />
                            <button
                              type="submit"
                              className={`${BOTAO_PRIMARIO} shrink-0 px-3`}
                            >
                              Lançar
                            </button>
                          </form>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
              {simMensagem && (
                <p className="text-sm font-bold text-emerald-700" role="status">
                  {simMensagem}
                </p>
              )}
              <div className="grid gap-3 lg:grid-cols-2">
                <section
                  className={`${CARTAO} min-w-0 p-3`}
                  aria-label="Programação dos próximos sete dias"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-black">
                      Programação dos próximos 7 dias
                    </h2>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <input
                        type="checkbox"
                        checked={semDomingo}
                        onChange={(event) =>
                          setSemDomingo(event.target.checked)
                        }
                      />{" "}
                      ocultar domingos
                    </label>
                  </div>
                  <div className="mt-3">
                    <TabelaPadrao
                      titulo=""
                      linhas={linhasSeteDias}
                      colunas={colunasSeteDias}
                      idDaLinha={(item) => item.id}
                      nomeDoItem={{ um: "dia", varios: "dias" }}
                      vazio="Nenhum dia programado."
                      densa
                      semPaginacao
                    />
                  </div>
                </section>
                <section
                  className={`${CARTAO} p-3`}
                  aria-label="Simulador de meta e prazo"
                >
                  <h2 className="font-black">Simular meta e prazo</h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <select
                      className={`${CAMPO} sm:col-span-2`}
                      value={simItemId}
                      onChange={(event) => setSimItemId(event.target.value)}
                      aria-label="Atividade da simulação"
                    >
                      <option value="">Selecione uma atividade</option>
                      {planejamento.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.servicoDescricao} ·{" "}
                          {item.frente || "Sem frente"}
                        </option>
                      ))}
                    </select>
                    <input
                      className={CAMPO}
                      value={simMeta}
                      onChange={(event) => setSimMeta(event.target.value)}
                      inputMode="decimal"
                      placeholder="Meta diária"
                      aria-label="Meta diária simulada"
                    />
                    <input
                      className={CAMPO}
                      type="date"
                      value={simFim}
                      onChange={(event) => setSimFim(event.target.value)}
                      aria-label="Novo prazo"
                    />
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={semDomingo}
                        onChange={(event) =>
                          setSemDomingo(event.target.checked)
                        }
                      />{" "}
                      considerar somente dias sem domingo
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 p-2">
                      Saldo
                      <strong className="mt-1 block text-base">
                        {simSaldo} {simItem?.unidade || ""}
                      </strong>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      Dias planejados
                      <strong className="mt-1 block text-base">
                        {simDias}
                      </strong>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      Fim calculado
                      <strong className="mt-1 block text-base">
                        {simFimCalculado || "—"}
                      </strong>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      Meta necessária
                      <strong className="mt-1 block text-base">
                        {simMetaCalculada} {simItem?.unidade || ""}/dia
                      </strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`${BOTAO_PRIMARIO} mt-3`}
                    onClick={aplicarSimulacao}
                    disabled={!podeEditar || !simItem}
                  >
                    <Save className="size-4" aria-hidden="true" /> Aplicar prazo
                    no plano
                  </button>
                </section>
              </div>
              <section
                className={`${CARTAO} p-3`}
                aria-label="Cronograma de programação"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-black">Cronograma</h2>
                  <span className="text-xs text-slate-500">
                    {inicioGantt} → {fimGantt}
                  </span>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <div className="min-w-[48rem]">
                    <div className="ml-48 grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
                      {semanaProgramacao.map((dia) => (
                        <span key={dia}>{formatarDia(dia)}</span>
                      ))}
                    </div>
                    {linhasGantt.map((item) => (
                      <div
                        key={item.id}
                        className="mt-2 flex items-center gap-2"
                      >
                        <span
                          className="w-44 truncate text-xs font-bold"
                          title={item.servicoDescricao}
                        >
                          {item.servicoDescricao}
                        </span>
                        <div className="relative h-7 flex-1 rounded bg-slate-100">
                          <div
                            className="absolute top-1 h-5 rounded bg-[#176b4d] px-2 text-xs font-bold leading-5 text-white"
                            style={{
                              left: `${percentualGantt(item.dataInicio)}%`,
                              width: `${larguraGantt(item.dataInicio, item.dataFim)}%`,
                            }}
                            title={`${item.dataInicio} a ${item.dataFim}`}
                          >
                            {item.frente || "Programado"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
        {podeEditar && (
          <div className={`${CARTAO} grid gap-2 p-3 sm:grid-cols-5`}>
            <select
              className={`${CAMPO} sm:col-span-2`}
              value={form.servicoId}
              onChange={(event) => atualizar("servicoId", event.target.value)}
              aria-label="Serviço do plano"
            >
              <option value="">Serviço</option>
              {servicos
                .filter((item) => item.ativo !== false)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.descricao}
                  </option>
                ))}
            </select>
            <input
              className={CAMPO}
              type="date"
              value={form.inicio}
              onChange={(event) => atualizar("inicio", event.target.value)}
              aria-label="Início"
            />
            <input
              className={CAMPO}
              type="date"
              value={form.fim}
              onChange={(event) => atualizar("fim", event.target.value)}
              aria-label="Fim"
            />
            <input
              className={CAMPO}
              inputMode="decimal"
              value={form.quantidade}
              onChange={(event) => atualizar("quantidade", event.target.value)}
              placeholder="Quantidade"
              aria-label="Quantidade planejada"
            />
            <input
              className={CAMPO}
              value={form.frente}
              onChange={(event) => atualizar("frente", event.target.value)}
              placeholder="Frente"
              aria-label="Frente do plano"
            />
            <button
              type="button"
              className={`${BOTAO_SECUNDARIO} sm:col-span-5`}
              onClick={salvarPlano}
            >
              <Check className="size-4" aria-hidden="true" /> Adicionar à
              programação
            </button>
          </div>
        )}
      </section>
    </TelaCheia>
  );
}
