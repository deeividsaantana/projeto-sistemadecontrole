/**
 * Solicitações e compras: um fluxo só, do pedido de campo até a entrega.
 * Requisição → Suprimentos (cotação e pedido) → aprovação da gerência →
 * a caminho → entregue. Cada pedido é um card com a linha de etapas, como
 * rastreio de entrega; a Conferência é onde os auxiliares marcam o que chegou
 * e o que falta; o Histórico junta a linha do tempo de todos os pedidos.
 * As regras (quem pode o quê, atraso, reagendamento com registro) estão em
 * src/utils/solicitacoes.ts; esta tela só mostra e chama.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  Filter,
  History,
  LayoutGrid,
  List,
  PackagePlus,
  PackageSearch,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Modal, PageHeader, isoDay } from "../shared/ui";
import { TelaCheia } from "../shared/ui/TelaCheia";
import { AbasDaTela, idDaAba, type ItemDasAbas } from "../shared/ui/AbasDaTela";
import { TabelaPadrao, type ColunaTabela } from "../shared/ui/TabelaPadrao";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  CAMPO,
  CARTAO,
} from "./cadastros/estilos";
import {
  NOME_DO_PAPEL,
  abrirSolicitacao,
  exerce,
  formatarDia,
  numeroBr,
  pessoaDoUsuario,
  situacaoDe,
  type Ator,
  type PessoaSuprimentos,
  type SituacaoSolicitacao,
  type Solicitacao,
} from "../utils/solicitacoes";
import {
  ehPlanilhaDeControle,
  historicoGeral,
  importarPlanilhaDeControle,
  linhasDeConferencia,
  validarImportacao,
  type LinhaConferencia,
  type ResultadoControle,
  type ResultadoImportacao,
} from "../utils/solicitacoesPlanilha";
import { NovaSolicitacao } from "./solicitacoes/NovaSolicitacao";
import { DetalheSolicitacao } from "./solicitacoes/DetalheSolicitacao";
import { SeloSituacao } from "./solicitacoes/SeloSituacao";
import { SeloItem } from "./solicitacoes/SeloItem";
import { CartaoCompraCompacto } from "./solicitacoes/CartaoCompraCompacto";
import { AvatarPessoa, dataHora } from "./solicitacoes/AvatarPessoa";
import { PlanilhaCompras } from "./solicitacoes/PlanilhaCompras";

type Subtela =
  | "pedidos"
  | "nova"
  | "filtros"
  | "aprovacao"
  | "conferencia"
  | "historico"
  | "planilha";

interface SolicitacoesTabProps {
  solicitacoes: Solicitacao[];
  pessoas: PessoaSuprimentos[];
  usuario: { nome: string; email?: string | null };
  /** Administrador do app: liga cada login a um papel do módulo. */
  ehAdmin: boolean;
  /** O perfil global de gestor também pode decidir pedidos, mesmo sem cadastro em Pessoas e papéis. */
  ehGestor?: boolean;
  /** Perfil do app que grava (leitura só consulta). */
  podeEditar: boolean;
  onSalvar: (registros: Solicitacao[], descricao: string) => void;
  onExcluir?: (id: string) => void;
}

type ComSituacao = { sol: Solicitacao; situacao: SituacaoSolicitacao };

/** Filtros dos pedidos em botões, com a contagem de cada um (como no rastreio). */
const FILTROS = [
  {
    id: "abertos",
    rotulo: "Em aberto",
    passa: (s: SituacaoSolicitacao) => s !== "Entregue" && s !== "Cancelado",
  },
  {
    id: "fila",
    rotulo: "Na fila",
    passa: (s: SituacaoSolicitacao) => s === "Pendente Suprimentos",
  },
  {
    id: "cotacao",
    rotulo: "Em cotação",
    passa: (s: SituacaoSolicitacao) => s === "Em Cotação",
  },
  {
    id: "aprovacao",
    rotulo: "Aprovação",
    passa: (s: SituacaoSolicitacao) => s === "Aguardando Aprovação",
  },
  {
    id: "caminho",
    rotulo: "A caminho",
    passa: (s: SituacaoSolicitacao) => s === "Aprovado" || s === "Em Trânsito",
  },
  {
    id: "atraso",
    rotulo: "Atrasados",
    passa: (s: SituacaoSolicitacao) => s === "Em Atraso",
  },
  {
    id: "entregues",
    rotulo: "Entregues",
    passa: (s: SituacaoSolicitacao) => s === "Entregue",
  },
  {
    id: "cancelados",
    rotulo: "Cancelados",
    passa: (s: SituacaoSolicitacao) => s === "Cancelado",
  },
  { id: "todos", rotulo: "Todos", passa: () => true },
] as const;
type Filtro = (typeof FILTROS)[number]["id"];

const FILTROS_CONFERENCIA = [
  "A conferir",
  "Faltando",
  "Parcial",
  "Chegou",
  "Todos",
] as const;
type FiltroConferencia = (typeof FILTROS_CONFERENCIA)[number];

const passaConferencia = (
  filtro: FiltroConferencia,
  linha: LinhaConferencia,
) => {
  if (filtro === "Todos") return true;
  if (filtro === "A conferir")
    return linha.situacao !== "Chegou" && linha.sol.etapa !== "Entregue";
  if (filtro === "Faltando") return linha.situacao === "Falta";
  return linha.situacao === filtro;
};

type Importacao =
  | { tipo: "modelo"; resultado: ResultadoImportacao }
  | { tipo: "controle"; resultado: ResultadoControle };

const POR_VEZ = 60;

const novoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const contem = (termo: string, valores: Array<string | number | undefined>) =>
  !termo ||
  valores.some(
    (valor) =>
      valor !== undefined && String(valor).toLowerCase().includes(termo),
  );

export default function SolicitacoesTab({
  solicitacoes,
  pessoas,
  usuario,
  ehAdmin,
  ehGestor = false,
  podeEditar,
  onSalvar,
  onExcluir,
}: SolicitacoesTabProps) {
  const escopo = useRef<HTMLElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const hoje = isoDay(new Date());
  const [subtela, setSubtela] = useState<Subtela>("pedidos");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("abertos");
  const [filtroSolicitante, setFiltroSolicitante] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [modo, setModo] = useState<"cards" | "lista">("cards");
  const [mostrar, setMostrar] = useState(POR_VEZ);
  const [filtroConferencia, setFiltroConferencia] =
    useState<FiltroConferencia>("A conferir");
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [importacao, setImportacao] = useState<Importacao | null>(null);
  const [aviso, setAviso] = useState<{
    tom: "ok" | "erro";
    texto: string;
  } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const novaFormRef = useRef<HTMLFormElement>(null);

  const pessoa = pessoaDoUsuario(pessoas, {
    nome: usuario.nome,
    email: usuario.email,
  });
  // Administrador sem pessoa ligada entra como dev: faz tudo no módulo.
  const papel =
    pessoa?.papel ?? (ehAdmin ? "dev" : ehGestor ? "aprovador" : null);
  const ator: Ator = {
    nome: pessoa?.nome ?? usuario.nome,
    papel: podeEditar ? papel : null,
    podeAprovar:
      pessoa?.podeAprovar ?? (ehAdmin || ehGestor ? true : undefined),
  };

  useEffect(() => {
    const teclar = (event: KeyboardEvent) => {
      const alvo = event.target as HTMLElement | null;
      const digitando = Boolean(
        alvo?.closest('input, textarea, select, [contenteditable="true"]'),
      );
      if (
        event.key.toLowerCase() === "n" &&
        !digitando &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        exerce(ator, "solicitante")
      ) {
        event.preventDefault();
        setAbertaId(null);
        setSubtela("nova");
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s" &&
        subtela === "nova" &&
        exerce(ator, "solicitante")
      ) {
        event.preventDefault();
        novaFormRef.current?.requestSubmit();
      }
    };
    document.addEventListener("keydown", teclar);
    return () => document.removeEventListener("keydown", teclar);
  }, [ator.nome, ator.papel, subtela]);

  useGSAP(
    () => {
      const raiz = escopo.current;
      if (
        !raiz ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      gsap.fromTo(
        raiz.querySelectorAll("[data-sol-reveal]"),
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.05,
          ease: "power3.out",
          clearProps: "transform,opacity",
        },
      );
    },
    { scope: escopo, dependencies: [subtela] },
  );

  const comSituacao = useMemo<ComSituacao[]>(
    () => solicitacoes.map((sol) => ({ sol, situacao: situacaoDe(sol, hoje) })),
    [solicitacoes, hoje],
  );
  const aguardandoAprovacao = comSituacao.filter(
    (item) => item.situacao === "Aguardando Aprovação",
  );
  const emAtraso = comSituacao.filter((item) => item.situacao === "Em Atraso");
  const termo = busca.trim().toLowerCase();
  const solicitantes = useMemo(
    () =>
      [
        ...new Set(solicitacoes.map((sol) => sol.solicitante).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [solicitacoes],
  );

  const contagem = useMemo(
    () =>
      Object.fromEntries(
        FILTROS.map((item) => [
          item.id,
          comSituacao.filter(({ situacao }) => item.passa(situacao)).length,
        ]),
      ) as Record<Filtro, number>,
    [comSituacao],
  );

  // Atrasados primeiro, depois a prioridade da planilha, depois os mais novos.
  const pedidos = useMemo(() => {
    const regra = FILTROS.find((item) => item.id === filtro) ?? FILTROS[0];
    return comSituacao
      .filter(({ situacao }) => regra.passa(situacao))
      .filter(
        ({ sol }) =>
          !filtroSolicitante || sol.solicitante === filtroSolicitante,
      )
      .filter(
        ({ sol }) =>
          !filtroDataInicio || sol.abertaEm.slice(0, 10) >= filtroDataInicio,
      )
      .filter(
        ({ sol }) =>
          !filtroDataFim || sol.abertaEm.slice(0, 10) <= filtroDataFim,
      )
      .filter(({ sol }) =>
        contem(termo, [
          sol.numero,
          sol.numeroSc,
          sol.numeroPedido,
          sol.solicitante,
          sol.frente,
          sol.estacamento,
          sol.fornecedor,
          ...sol.itens.map((item) => item.descricao),
        ]),
      )
      .sort(
        (a, b) =>
          Number(b.situacao === "Em Atraso") -
            Number(a.situacao === "Em Atraso") ||
          (a.sol.prioridade ?? 999) - (b.sol.prioridade ?? 999) ||
          b.sol.abertaEm.localeCompare(a.sol.abertaEm),
      );
  }, [
    comSituacao,
    filtro,
    termo,
    filtroSolicitante,
    filtroDataInicio,
    filtroDataFim,
  ]);

  const conferencia = useMemo(
    () => linhasDeConferencia(solicitacoes),
    [solicitacoes],
  );
  const itensComFalta = conferencia.filter(
    (linha) => linha.situacao === "Falta",
  ).length;
  const linhasConferencia = useMemo(
    () =>
      conferencia
        .filter((linha) => passaConferencia(filtroConferencia, linha))
        .filter(({ sol, item }) =>
          contem(termo, [
            sol.numero,
            sol.numeroSc,
            sol.solicitante,
            item.descricao,
          ]),
        ),
    [conferencia, filtroConferencia, termo],
  );

  const historico = useMemo(() => historicoGeral(solicitacoes), [solicitacoes]);
  const linhasHistorico = useMemo(
    () =>
      historico.filter((evento) =>
        contem(termo, [
          evento.sol.numero,
          evento.sol.numeroSc,
          evento.usuario,
          evento.acao,
          evento.detalhe,
        ]),
      ),
    [historico, termo],
  );
  const linhasAprovacao = useMemo(
    () =>
      aguardandoAprovacao.filter(({ sol }) =>
        contem(termo, [
          sol.numero,
          sol.numeroSc,
          sol.solicitante,
          sol.frente,
          sol.numeroPedido,
          sol.fornecedor,
          ...sol.itens.map((item) => item.descricao),
        ]),
      ),
    [aguardandoAprovacao, termo],
  );

  const aberta = solicitacoes.find((sol) => sol.id === abertaId) ?? null;
  // O pedido abre na aba inteira: volta ao topo para começar pelas etapas.
  const abrirPedido = (id: string) => {
    setAbertaId(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const salvarUma = (sol: Solicitacao, descricao: string) => {
    onSalvar([sol], descricao);
    setAviso({ tom: "ok", texto: descricao });
  };

  const escolherArquivo = async (selecionado?: File) => {
    if (arquivo.current) arquivo.current.value = "";
    if (!selecionado) return;
    setOcupado(true);
    setAviso(null);
    try {
      const { lerArquivoDeImportacao } = await import(
        "./solicitacoes/planilhaSolicitacoes"
      );
      const abas = await lerArquivoDeImportacao(selecionado);
      setImportacao(
        ehPlanilhaDeControle(abas)
          ? {
              tipo: "controle",
              resultado: importarPlanilhaDeControle(
                abas,
                solicitacoes,
                ator.nome,
                new Date().toISOString(),
              ),
            }
          : {
              tipo: "modelo",
              resultado: validarImportacao(abas[0]?.linhas ?? [], pessoas),
            },
      );
    } catch (error) {
      setAviso({
        tom: "erro",
        texto:
          error instanceof Error
            ? error.message
            : "Não foi possível ler o arquivo.",
      });
    } finally {
      setOcupado(false);
    }
  };

  const confirmarImportacao = () => {
    if (!importacao) return;
    if (importacao.tipo === "controle") {
      const { novas } = importacao.resultado;
      if (novas.length)
        onSalvar(
          novas,
          `Trouxe ${novas.length} pedido(s) da planilha de controle.`,
        );
      setAviso({
        tom: "ok",
        texto: `${novas.length} pedido(s) entraram no fluxo. Cada um já tem card e histórico.`,
      });
      setImportacao(null);
      return;
    }
    const agora = new Date().toISOString();
    const criadas: Solicitacao[] = [];
    for (const { dados } of importacao.resultado.aceitas) {
      const resultado = abrirSolicitacao(
        dados,
        { nome: ator.nome, papel: "solicitante" },
        [...solicitacoes, ...criadas],
        agora,
        novoId(),
      );
      if ("solicitacao" in resultado)
        criadas.push({
          ...resultado.solicitacao,
          eventos: [
            { data: agora, usuario: ator.nome, acao: "Importou da planilha" },
          ],
        });
    }
    if (criadas.length)
      onSalvar(
        criadas,
        `Importou ${criadas.length} solicitação(ões) da planilha.`,
      );
    setAviso({
      tom: "ok",
      texto: `${criadas.length} solicitação(ões) importada(s)${importacao.resultado.rejeitadas.length ? `, ${importacao.resultado.rejeitadas.length} linha(s) recusada(s)` : ""}.`,
    });
    setImportacao(null);
  };

  const exportar = async () => {
    setOcupado(true);
    try {
      const { baixarRelatorios } = await import(
        "./solicitacoes/planilhaSolicitacoes"
      );
      await baixarRelatorios(solicitacoes, hoje);
    } catch (error) {
      setAviso({
        tom: "erro",
        texto:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar a planilha.",
      });
    } finally {
      setOcupado(false);
    }
  };

  const baixarModelo = async () => {
    const { baixarModeloDeImportacao } = await import(
      "./solicitacoes/planilhaSolicitacoes"
    );
    await baixarModeloDeImportacao();
  };

  const podeImportar =
    ehAdmin ||
    exerce(ator, "solicitante") ||
    exerce(ator, "suprimentos") ||
    exerce(ator, "recebedor");

  const subtelas: ItemDasAbas<Subtela>[] = [
    {
      id: "pedidos",
      rotulo: "Pedidos",
      icone: PackageSearch,
      contador: emAtraso.length,
      contadorRotulo: "em atraso",
    },
    ...(exerce(ator, "aprovador")
      ? [
          {
            id: "aprovacao" as const,
            rotulo: "Aprovações",
            icone: ShieldCheck,
            contador: aguardandoAprovacao.length,
            contadorRotulo: "aguardando decisão",
          },
        ]
      : []),
    {
      id: "conferencia",
      rotulo: "Conferência",
      icone: ClipboardList,
      contador: itensComFalta,
      contadorRotulo: "itens com falta",
    },
    { id: "historico", rotulo: "Histórico", icone: History },
    { id: "planilha", rotulo: "Planilha", icone: FileSpreadsheet },
  ];

  const colunas: ColunaTabela<ComSituacao>[] = [
    {
      chave: "numero",
      titulo: "Solicitação",
      larguraIdeal: 128,
      render: ({ sol }) => (
        <strong className="font-black text-slate-900">{sol.numero}</strong>
      ),
      valorOrdenacao: ({ sol }) => sol.abertaEm,
      valorExportacao: ({ sol }) => sol.numero,
    },
    {
      chave: "solicitante",
      titulo: "Solicitante",
      larguraIdeal: 120,
      render: ({ sol }) => sol.solicitante,
      valorOrdenacao: ({ sol }) => sol.solicitante,
    },
    {
      chave: "sc",
      titulo: "SC",
      larguraIdeal: 100,
      render: ({ sol }) => sol.numeroSc ?? "—",
      dica: ({ sol }) => sol.numeroSc,
      valorOrdenacao: ({ sol }) => sol.numeroSc,
    },
    {
      chave: "itens",
      titulo: "Itens",
      larguraIdeal: 180,
      render: ({ sol }) =>
        `${sol.itens[0]?.descricao ?? ""}${sol.itens.length > 1 ? ` (+${sol.itens.length - 1})` : ""}`,
      dica: ({ sol }) => sol.itens.map((item) => item.descricao).join("; "),
    },
    {
      chave: "situacao",
      titulo: "Situação",
      larguraIdeal: 165,
      render: ({ situacao }) => <SeloSituacao situacao={situacao} />,
      valorOrdenacao: ({ situacao }) => situacao,
      valorExportacao: ({ situacao }) => situacao,
    },
    {
      chave: "pedido",
      titulo: "Pedido",
      larguraIdeal: 150,
      render: ({ sol }) =>
        sol.numeroPedido
          ? `${sol.numeroPedido} · ${sol.fornecedor ?? ""}`
          : "—",
      dica: ({ sol }) => sol.fornecedor,
      valorOrdenacao: ({ sol }) => sol.numeroPedido,
    },
    {
      chave: "janela",
      titulo: "Entrega até",
      larguraIdeal: 100,
      render: ({ sol }) => formatarDia(sol.janelaFim),
      valorOrdenacao: ({ sol }) => sol.janelaFim,
    },
  ];

  const colunasConferencia: ColunaTabela<LinhaConferencia>[] = [
    {
      chave: "pedido",
      titulo: "Pedido",
      larguraIdeal: 120,
      render: ({ sol }) => (
        <strong className="font-black text-slate-900">{sol.numero}</strong>
      ),
      valorOrdenacao: ({ sol }) => sol.numero,
      valorExportacao: ({ sol }) => sol.numero,
    },
    {
      chave: "sc",
      titulo: "SC",
      larguraIdeal: 96,
      render: ({ sol }) => sol.numeroSc ?? "—",
      dica: ({ sol }) => sol.numeroSc,
      valorOrdenacao: ({ sol }) => sol.numeroSc,
    },
    {
      chave: "item",
      titulo: "Item",
      larguraIdeal: 220,
      render: ({ item }) => item.descricao,
      dica: ({ item }) => item.descricao,
      valorOrdenacao: ({ item }) => item.descricao,
    },
    {
      chave: "pedida",
      titulo: "Pedido (qtd.)",
      alinhamento: "direita",
      larguraIdeal: 96,
      render: ({ item }) =>
        `${numeroBr(item.quantidadePedido ?? item.quantidade)} ${item.unidade}`,
      valorOrdenacao: ({ item }) => item.quantidade,
    },
    {
      chave: "chegou",
      titulo: "Chegou",
      alinhamento: "direita",
      larguraIdeal: 84,
      render: ({ item }) =>
        `${numeroBr(item.quantidadeRecebida ?? 0)} ${item.unidade}`,
      valorOrdenacao: ({ item }) => item.quantidadeRecebida ?? 0,
    },
    {
      chave: "situacao",
      titulo: "Conferência",
      larguraIdeal: 110,
      render: ({ situacao }) => <SeloItem situacao={situacao} />,
      valorOrdenacao: ({ situacao }) => situacao,
      valorExportacao: ({ situacao }) => situacao,
    },
    {
      chave: "solicitante",
      titulo: "Solicitante",
      larguraIdeal: 120,
      render: ({ sol }) => sol.solicitante,
      valorOrdenacao: ({ sol }) => sol.solicitante,
    },
    {
      chave: "ultima",
      titulo: "Última conferência",
      larguraIdeal: 150,
      render: ({ item }) => {
        const ultima = item.conferencias?.[item.conferencias.length - 1];
        return ultima ? (
          <span className="flex items-center gap-2">
            <AvatarPessoa nome={ultima.usuario} tamanho="sm" />
            {formatarDia(ultima.data)}
          </span>
        ) : (
          "—"
        );
      },
      dica: ({ item }) =>
        item.conferencias?.[item.conferencias.length - 1]?.usuario,
      valorExportacao: ({ item }) => {
        const ultima = item.conferencias?.[item.conferencias.length - 1];
        return ultima ? `${formatarDia(ultima.data)} · ${ultima.usuario}` : "";
      },
    },
  ];

  const colunasHistorico: ColunaTabela<(typeof historico)[number]>[] = [
    {
      chave: "data",
      titulo: "Quando",
      larguraIdeal: 130,
      render: (evento) => dataHora(evento.data),
      valorOrdenacao: (evento) => evento.data,
    },
    {
      chave: "pedido",
      titulo: "Pedido",
      larguraIdeal: 120,
      render: (evento) => (
        <strong className="font-black text-slate-900">
          {evento.sol.numero}
        </strong>
      ),
      valorOrdenacao: (evento) => evento.sol.numero,
      valorExportacao: (evento) => evento.sol.numero,
    },
    {
      chave: "quem",
      titulo: "Quem",
      larguraIdeal: 150,
      render: (evento) => (
        <span className="flex items-center gap-2">
          <AvatarPessoa nome={evento.usuario} tamanho="sm" />
          {evento.usuario}
        </span>
      ),
      valorOrdenacao: (evento) => evento.usuario,
      valorExportacao: (evento) => evento.usuario,
    },
    {
      chave: "acao",
      titulo: "O que aconteceu",
      larguraIdeal: 190,
      render: (evento) => evento.acao,
      valorOrdenacao: (evento) => evento.acao,
    },
    {
      chave: "detalhe",
      titulo: "Detalhe",
      larguraIdeal: 260,
      render: (evento) => evento.detalhe ?? "",
      dica: (evento) => evento.detalhe,
    },
  ];

  const comTabela =
    (subtela === "pedidos" && modo === "lista") ||
    subtela === "aprovacao" ||
    subtela === "conferencia" ||
    subtela === "historico";
  const comBusca =
    subtela === "aprovacao" ||
    subtela === "conferencia" ||
    subtela === "historico";
  const irPara = (proximo: Filtro) => {
    setAbertaId(null);
    setSubtela("pedidos");
    setFiltro(proximo);
    setMostrar(POR_VEZ);
  };
  const irParaAprovacao = () => {
    setAbertaId(null);
    setSubtela("aprovacao");
    setBusca("");
  };
  const irParaConferencia = () => {
    setAbertaId(null);
    setSubtela("conferencia");
    setFiltroConferencia("A conferir");
  };
  const resumo = [
    {
      id: "abertos",
      rotulo: "Em aberto",
      valor: contagem.abertos,
      detalhe: "pedidos no fluxo",
      tom: "text-[#176b4d]",
    },
    {
      id: "aprovacao",
      rotulo: "Aprovações",
      valor: aguardandoAprovacao.length,
      detalhe: exerce(ator, "aprovador")
        ? "aguardando sua decisão"
        : "aguardando gerência",
      tom: "text-[#c2410c]",
    },
    {
      id: "atraso",
      rotulo: "Em atraso",
      valor: emAtraso.length,
      detalhe: "pedidos para cobrar",
      tom: "text-rose-700",
    },
    {
      id: "conferencia",
      rotulo: "A conferir",
      valor: itensComFalta,
      detalhe: "itens aguardando chegada",
      tom: "text-slate-900",
    },
    {
      id: "entregues",
      rotulo: "Entregues",
      valor: contagem.entregues,
      detalhe: "pedidos concluídos",
      tom: "text-[#176b4d]",
    },
  ] as const;

  return (
    <TelaCheia
      ref={escopo}
      id="solicitacoes-tab"
      rotulo="Solicitações e compras"
      longa={!comTabela || Boolean(aberta)}
      idAbaAtiva={idDaAba("solicitacoes", subtela)}
      idDados="solicitacoes-dados"
      chaveRolagem={`${subtela}-${abertaId ?? ""}`}
      cabecalho={
        <PageHeader
          eyebrow="Suprimentos"
          title="Solicitações e compras"
          abas={
            <AbasDaTela<Subtela>
              id="solicitacoes"
              rotulo="Subtelas de solicitações"
              abas={subtelas}
              ativa={subtela}
              onTrocar={(proxima) => {
                setAbertaId(null);
                setSubtela(proxima);
              }}
              idPainel="solicitacoes-dados"
              testId="solicitacoes-aba"
            />
          }
          actions={
            <>
              {!aberta && (
                <>
                  <button
                    type="button"
                    onClick={() => void exportar()}
                    disabled={ocupado || solicitacoes.length === 0}
                    className={BOTAO_SECUNDARIO}
                  >
                    <FileSpreadsheet className="size-4" aria-hidden="true" />{" "}
                    <span className="sm:hidden">Excel</span>
                    <span className="hidden sm:inline">Relatórios Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void (async () => {
                        setOcupado(true);
                        try {
                          const { gerarRelatorioSolicitacoesPdf } =
                            await import(
                              "./solicitacoes/pdfReportSolicitacoes"
                            );
                          await gerarRelatorioSolicitacoesPdf(
                            solicitacoes,
                            hoje,
                          );
                          setAviso({
                            tom: "ok",
                            texto:
                              "Relatório PDF gerado com os pedidos, itens, prazos e conferência.",
                          });
                        } catch (error) {
                          setAviso({
                            tom: "erro",
                            texto:
                              error instanceof Error
                                ? error.message
                                : "Não foi possível gerar o relatório PDF.",
                          });
                        } finally {
                          setOcupado(false);
                        }
                      })()
                    }
                    disabled={ocupado || solicitacoes.length === 0}
                    className={BOTAO_SECUNDARIO}
                    data-testid="solicitacoes-relatorio-pdf"
                  >
                    <ClipboardList className="size-4" aria-hidden="true" />{" "}
                    <span className="sm:hidden">PDF</span>
                    <span className="hidden sm:inline">Relatório PDF</span>
                  </button>
                </>
              )}
              {podeImportar && podeEditar && (
                <button
                  type="button"
                  onClick={() => arquivo.current?.click()}
                  disabled={ocupado}
                  className={BOTAO_SECUNDARIO}
                >
                  <Upload className="size-4" aria-hidden="true" />{" "}
                  <span className="sm:hidden">Importar</span>
                  <span className="hidden sm:inline">Importar planilha</span>
                </button>
              )}
              {exerce(ator, "solicitante") && subtela !== "nova" && (
                <button
                  type="button"
                  onClick={() => setSubtela("nova")}
                  className={BOTAO_PRIMARIO}
                >
                  <PackagePlus className="size-4" aria-hidden="true" />{" "}
                  <span className="sm:hidden">Nova</span>
                  <span className="hidden sm:inline">Nova solicitação</span>
                </button>
              )}
            </>
          }
        />
      }
      faixa={
        <div
          data-sol-reveal
          className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
        >
          {subtela === "pedidos" && (
            <button
              type="button"
              onClick={() => setSubtela("filtros")}
              className={`${BOTAO_SECUNDARIO} min-h-10 shrink-0 px-3`}
              aria-label="Abrir filtros de solicitações"
            >
              <Filter className="size-4" aria-hidden="true" />
              <span>Filtros</span>
            </button>
          )}
          {subtela === "pedidos" && (
            <section
              aria-label="Resumo operacional de solicitações"
              className="flex min-w-0 flex-1 items-center gap-1.5"
            >
              <span className="sr-only">Resumo operacional</span>
              {resumo.map((item) => (
                <div
                  key={item.id}
                  data-testid={`resumo-solicitacoes-${item.id}`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                  title={`${item.rotulo}: ${item.valor} ${item.detalhe}`}
                >
                  <span className="truncate text-xs font-bold text-slate-600">
                    {item.rotulo}
                  </span>
                  <strong
                    className={`text-base font-black tabular-nums ${item.tom}`}
                  >
                    {item.valor}
                  </strong>
                </div>
              ))}
            </section>
          )}
          {/* Uma linha só: quem é você, avisos, busca e o jeito de mostrar. */}
          <div className="contents text-sm text-slate-600">
            <span
              className={`min-w-0 items-center gap-1.5 ${ator.papel ? "hidden sm:flex" : "flex"}`}
            >
              <ClipboardCheck
                className="size-4 shrink-0 text-[#176b4d]"
                aria-hidden="true"
              />
              {ator.papel ? (
                <span className="truncate">
                  <strong className="text-slate-900">{ator.nome}</strong> ·{" "}
                  {NOME_DO_PAPEL[ator.papel]}
                </span>
              ) : (
                <span>
                  Seu login só consulta este módulo.
                  {ehAdmin &&
                    " Vincule o login a uma pessoa em Cadastros > Acessos."}
                </span>
              )}
            </span>
            {exerce(ator, "aprovador") &&
              aguardandoAprovacao.length > 0 &&
              subtela !== "aprovacao" && (
                <button
                  type="button"
                  onClick={irParaAprovacao}
                  className="flex min-h-9 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 text-sm font-bold text-amber-900"
                >
                  <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />{" "}
                  {aguardandoAprovacao.length} para você aprovar
                </button>
              )}
            {emAtraso.length > 0 &&
              !(subtela === "pedidos" && filtro === "atraso") && (
                <button
                  type="button"
                  onClick={() => irPara("atraso")}
                  title="Passou o fim da janela sem confirmação de chegada"
                  className={`min-h-9 items-center ${subtela === "pedidos" ? "hidden sm:flex" : "flex"} gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 text-sm font-bold text-rose-800`}
                >
                  <AlertTriangle
                    className="size-4 shrink-0"
                    aria-hidden="true"
                  />{" "}
                  {emAtraso.length} em atraso
                </button>
              )}
            {comBusca && !aberta && (
              <div className="contents">
                <label className="relative min-w-[16rem] flex-1">
                  <span className="sr-only">Buscar</span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={busca}
                    onChange={(event) => {
                      setBusca(event.target.value);
                      setMostrar(POR_VEZ);
                    }}
                    placeholder={
                      subtela === "historico"
                        ? "Pedido, SC, pessoa, o que aconteceu..."
                        : subtela === "aprovacao"
                          ? "Pedido, SC, solicitante, item..."
                          : "Pedido, SC, item, solicitante..."
                    }
                    className={`${CAMPO} pl-9`}
                  />
                </label>
                {subtela === "conferencia" && (
                  <select
                    value={filtroConferencia}
                    onChange={(event) =>
                      setFiltroConferencia(
                        event.target.value as FiltroConferencia,
                      )
                    }
                    aria-label="Mostrar itens"
                    className={`${CAMPO} w-auto sm:w-48`}
                  >
                    {FILTROS_CONFERENCIA.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
          {aviso && (
            <p
              role={aviso.tom === "erro" ? "alert" : "status"}
              className={`rounded-xl border px-3 py-2 text-sm font-bold ${aviso.tom === "erro" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
            >
              {aviso.texto}
            </p>
          )}
          {subtela === "aprovacao" && !aberta && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <span>
                <strong>Fila do gerente:</strong> confira o pedido, o
                fornecedor, o valor e o prazo antes de decidir.
              </span>
              <span className="font-black tabular-nums">
                {linhasAprovacao.length} aguardando
              </span>
            </div>
          )}
        </div>
      }
    >
      <input
        ref={arquivo}
        type="file"
        accept=".xlsx,.csv"
        hidden
        onChange={(event) => void escolherArquivo(event.target.files?.[0])}
      />

      {aberta ? (
        <section
          data-sol-reveal
          aria-labelledby="pedido-aberto-titulo"
          className="grid min-w-0 gap-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setAbertaId(null)}
              className={BOTAO_SECUNDARIO}
              data-testid="pedido-voltar"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Voltar
            </button>
            <div className="min-w-0">
              <h2
                id="pedido-aberto-titulo"
                className="text-lg font-black text-slate-900"
              >
                {aberta.origem === "planilha-controle" || !aberta.frente
                  ? aberta.numero
                  : `${aberta.numero} · ${aberta.frente}`}
              </h2>
              <p className="text-sm text-slate-600">
                Aberta por {aberta.solicitante} em{" "}
                {formatarDia(aberta.abertaEm)}
              </p>
            </div>
          </div>
          <DetalheSolicitacao
            key={`${aberta.id}-${aberta.atualizadoEm}`}
            solicitacao={aberta}
            todas={solicitacoes}
            ator={ator}
            hoje={hoje}
            onSalvar={salvarUma}
            podeExcluir={ehAdmin}
            onExcluir={() => {
              onExcluir?.(aberta.id);
              setAbertaId(null);
            }}
          />
        </section>
      ) : (
        <>
          {subtela === "filtros" && (
            <section
              data-sol-reveal
              aria-labelledby="filtros-solicitacoes-titulo"
              className="grid min-h-0 content-start gap-4"
            >
              <div className={`${CARTAO} grid gap-4 p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#176b4d]">
                      Pesquisa avançada
                    </p>
                    <h2
                      id="filtros-solicitacoes-titulo"
                      className="text-xl font-black text-slate-900"
                    >
                      Filtrar solicitações
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Os filtros ficam separados para deixar a aba de pedidos
                      livre e com o máximo de espaço para os cards.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-[#176b4d]">
                    {pedidos.length} resultado(s)
                  </span>
                </div>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
                  <label className="grid gap-1.5 text-sm font-bold text-slate-700 lg:col-span-3">
                    Buscar pedido, SC, item ou solicitante
                    <span className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={busca}
                        onChange={(event) => {
                          setBusca(event.target.value);
                          setMostrar(POR_VEZ);
                        }}
                        placeholder="Ex.: José Augusto, SOL-2026, tubos..."
                        className={`${CAMPO} pl-9`}
                      />
                    </span>
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                    Solicitante
                    <select
                      aria-label="Filtrar por solicitante"
                      value={filtroSolicitante}
                      onChange={(event) =>
                        setFiltroSolicitante(event.target.value)
                      }
                      className={CAMPO}
                    >
                      <option value="">Todos</option>
                      {solicitantes.map((nome) => (
                        <option key={nome}>{nome}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                    Data inicial
                    <input
                      aria-label="Data inicial"
                      type="date"
                      value={filtroDataInicio}
                      onChange={(event) =>
                        setFiltroDataInicio(event.target.value)
                      }
                      className={CAMPO}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold text-slate-700">
                    Data final
                    <input
                      aria-label="Data final"
                      type="date"
                      value={filtroDataFim}
                      onChange={(event) => setFiltroDataFim(event.target.value)}
                      className={CAMPO}
                    />
                  </label>
                </div>
                <div className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700">
                    Situação do pedido
                  </span>
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label="Filtrar por situação"
                  >
                    {FILTROS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={filtro === item.id}
                        onClick={() => {
                          setFiltro(item.id);
                          setMostrar(POR_VEZ);
                        }}
                        data-testid={`filtro-${item.id}`}
                        className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-bold ${filtro === item.id ? "border-[#176b4d] bg-[#176b4d] text-white" : item.id === "atraso" && contagem.atraso > 0 ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-700 hover:border-[#176b4d]"}`}
                      >
                        {item.rotulo}{" "}
                        <span className="tabular-nums opacity-80">
                          {contagem[item.id]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div
                    className="flex items-center gap-2"
                    role="group"
                    aria-label="Modo de visualização"
                  >
                    <span className="text-sm font-bold text-slate-700">
                      Exibição
                    </span>
                    {(
                      [
                        ["cards", "Cards", LayoutGrid],
                        ["lista", "Lista", List],
                      ] as const
                    ).map(([id, rotulo, Icone]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={modo === id}
                        onClick={() => setModo(id)}
                        className={`${modo === id ? BOTAO_PRIMARIO : BOTAO_SECUNDARIO} min-h-10`}
                      >
                        <Icone className="size-4" aria-hidden="true" /> {rotulo}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBusca("");
                        setFiltro("abertos");
                        setFiltroSolicitante("");
                        setFiltroDataInicio("");
                        setFiltroDataFim("");
                        setMostrar(POR_VEZ);
                      }}
                      className={BOTAO_SECUNDARIO}
                    >
                      Limpar filtros
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubtela("pedidos")}
                      className={BOTAO_PRIMARIO}
                    >
                      Ver pedidos
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
          {subtela === "pedidos" &&
            modo === "cards" &&
            (pedidos.length === 0 ? (
              <p
                data-sol-reveal
                className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600"
              >
                Nenhum pedido neste filtro.
                {solicitacoes.length === 0 &&
                  ' Abra uma solicitação ou traga a planilha de controle em "Importar planilha".'}
              </p>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <ul
                  data-sol-reveal
                  className="grid min-h-0 flex-1 content-start grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                >
                  {pedidos.slice(0, mostrar).map(({ sol }) => (
                    <CartaoCompraCompacto
                      key={sol.id}
                      sol={sol}
                      hoje={hoje}
                      ativo={sol.id === abertaId}
                      onAbrir={() => abrirPedido(sol.id)}
                    />
                  ))}
                </ul>
                {pedidos.length > mostrar && (
                  <button
                    type="button"
                    onClick={() => setMostrar((atual) => atual + POR_VEZ)}
                    className={`${BOTAO_SECUNDARIO} justify-self-center`}
                  >
                    Mostrar mais {Math.min(POR_VEZ, pedidos.length - mostrar)}{" "}
                    de {pedidos.length - mostrar} restantes
                  </button>
                )}
              </div>
            ))}

          {subtela === "pedidos" && modo === "lista" && (
            <div data-sol-reveal className="min-h-0 flex-1">
              <TabelaPadrao
                titulo="Pedidos"
                linhas={pedidos}
                colunas={colunas}
                idDaLinha={({ sol }) => sol.id}
                nomeDoItem={{ um: "pedido", varios: "pedidos" }}
                onAbrirLinha={({ sol }) => abrirPedido(sol.id)}
                linhaAtivaId={abertaId}
                classeLinha={({ situacao }) =>
                  situacao === "Em Atraso" ? "bg-rose-50" : undefined
                }
                vazio="Nenhum pedido neste filtro."
                testIdLinha="solicitacao-linha"
                densa
              />
            </div>
          )}

          {subtela === "aprovacao" && (
            <div data-sol-reveal className="min-h-0 flex-1">
              <TabelaPadrao
                titulo="Pedidos aguardando aprovação"
                linhas={linhasAprovacao}
                colunas={colunas}
                idDaLinha={({ sol }) => sol.id}
                nomeDoItem={{ um: "pedido", varios: "pedidos" }}
                onAbrirLinha={({ sol }) => abrirPedido(sol.id)}
                linhaAtivaId={abertaId}
                vazio="Nenhum pedido aguardando aprovação."
                testIdLinha="aprovacao-linha"
                densa
              />
            </div>
          )}

          {subtela === "conferencia" && (
            <div data-sol-reveal className="min-h-0 flex-1">
              <TabelaPadrao
                titulo="Conferência de itens"
                linhas={linhasConferencia}
                colunas={colunasConferencia}
                idDaLinha={({ sol, item }) => `${sol.id}-${item.itemId}`}
                nomeDoItem={{ um: "item", varios: "itens" }}
                onAbrirLinha={({ sol }) => abrirPedido(sol.id)}
                classeLinha={({ situacao }) =>
                  situacao === "Falta" ? "bg-rose-50" : undefined
                }
                vazio={
                  filtroConferencia === "A conferir"
                    ? "Nada esperando conferência."
                    : "Nenhum item neste filtro."
                }
                testIdLinha="conferencia-linha"
                densa
              />
            </div>
          )}

          {subtela === "historico" && (
            <div data-sol-reveal className="min-h-0 flex-1">
              <TabelaPadrao
                titulo="Histórico de todos os pedidos"
                linhas={linhasHistorico}
                colunas={colunasHistorico}
                idDaLinha={(evento) => evento.id}
                nomeDoItem={{ um: "registro", varios: "registros" }}
                onAbrirLinha={(evento) => abrirPedido(evento.sol.id)}
                ordenacaoInicial={{ chave: "data", direcao: "desc" }}
                vazio="Nenhum registro ainda."
                testIdLinha="historico-linha"
                densa
              />
            </div>
          )}
          {subtela === "planilha" && <PlanilhaCompras />}

          {subtela === "nova" && exerce(ator, "solicitante") && (
            <NovaSolicitacao
              formRef={novaFormRef}
              solicitante={ator.nome}
              solicitantesPermitidos={pessoas
                .filter(
                  (pessoa) => pessoa.ativo && pessoa.papel === "solicitante",
                )
                .map((pessoa) => pessoa.nome)}
              onEnviar={(dados) => {
                const resultado = abrirSolicitacao(
                  dados,
                  ator,
                  solicitacoes,
                  new Date().toISOString(),
                  novoId(),
                );
                if ("erro" in resultado) return resultado.erro;
                salvarUma(
                  resultado.solicitacao,
                  `Abriu a solicitação ${resultado.solicitacao.numero}. Suprimentos já vê na fila.`,
                );
                irPara("abertos");
                return null;
              }}
            />
          )}
        </>
      )}

      <Modal
        open={Boolean(importacao)}
        onClose={() => setImportacao(null)}
        title={
          importacao?.tipo === "controle"
            ? "Trazer a planilha de controle"
            : "Conferir importação"
        }
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {importacao?.tipo === "modelo" && (
              <button
                type="button"
                onClick={() => void baixarModelo()}
                className={BOTAO_SECUNDARIO}
              >
                Baixar modelo
              </button>
            )}
            <button
              type="button"
              onClick={() => setImportacao(null)}
              className={BOTAO_SECUNDARIO}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarImportacao}
              disabled={
                importacao?.tipo === "controle"
                  ? !importacao.resultado.novas.length
                  : !importacao?.resultado.aceitas.length
              }
              className={BOTAO_PRIMARIO}
            >
              {importacao?.tipo === "controle"
                ? `Trazer ${importacao.resultado.novas.length} pedido(s)`
                : `Importar ${importacao?.resultado.aceitas.length ?? 0} linha(s)`}
            </button>
          </div>
        }
      >
        {importacao?.tipo === "controle" && (
          <div className="grid gap-3 text-sm">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  [
                    "Pedidos novos",
                    importacao.resultado.novas.length,
                    "text-[#176b4d]",
                  ],
                  [
                    "Itens",
                    importacao.resultado.novas.reduce(
                      (soma, sol) => soma + sol.itens.length,
                      0,
                    ),
                    "text-slate-900",
                  ],
                  [
                    "Já estavam no sistema",
                    importacao.resultado.jaImportados.length,
                    "text-slate-900",
                  ],
                  [
                    "Linhas recusadas",
                    importacao.resultado.rejeitadas.length,
                    "text-rose-700",
                  ],
                ] as const
              ).map(([rotulo, valor, cor]) => (
                <div key={rotulo} className="rounded-xl bg-[#f7f8f6] p-3">
                  <dt className="text-xs text-slate-600">{rotulo}</dt>
                  <dd className={`text-xl font-black tabular-nums ${cor}`}>
                    {valor}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-slate-700">
              Cada número de pedido vira um card no fluxo. Sem SC entra na fila
              de Suprimentos; com SC entra em cotação; com "OK" na previsão
              entra como entregue. Nada do que a planilha não diz é inventado.
            </p>
            {importacao.resultado.jaImportados.length > 0 && (
              <p className="text-slate-600">
                Pode trazer a planilha de novo sem medo: pedido que já está no
                sistema não é duplicado.
              </p>
            )}
            {importacao.resultado.rejeitadas.length > 0 && (
              <ul className="grid max-h-60 gap-1 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50 p-3">
                {importacao.resultado.rejeitadas.map((item) => (
                  <li
                    key={`${item.linha}-${item.motivo}`}
                    className="text-rose-800"
                  >
                    <strong>Linha {item.linha}:</strong> {item.motivo}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {importacao?.tipo === "modelo" && (
          <div className="grid gap-3 text-sm">
            <p className="text-slate-700">
              <strong className="text-[#176b4d]">
                {importacao.resultado.aceitas.length}
              </strong>{" "}
              linha(s) prontas para virar solicitação.{" "}
              <strong className="text-rose-700">
                {importacao.resultado.rejeitadas.length}
              </strong>{" "}
              recusada(s).
            </p>
            {importacao.resultado.rejeitadas.length > 0 && (
              <ul className="grid max-h-72 gap-1 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50 p-3">
                {importacao.resultado.rejeitadas.map((item) => (
                  <li key={item.linha} className="text-rose-800">
                    <strong>Linha {item.linha}:</strong> {item.motivo}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-slate-600">
              Colunas esperadas: Solicitante, Tipo (Material/Serviço),
              Ramo/Local, Descrição, Quantidade, Unidade, Prazo Desejado e
              Permite Parcial (S/N). A planilha de controle de pedidos de compra
              também é aceita.
            </p>
          </div>
        )}
      </Modal>
    </TelaCheia>
  );
}
