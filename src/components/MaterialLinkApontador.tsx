/**
 * Link do apontador de materiais, aberto no celular sem login. Três passos,
 * um de cada vez: escolher o ramo, escolher o material e a quantidade, e
 * mandar com foto (câmera aqui dentro ou foto da galeria) e o GPS do momento.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Images,
  LocateFixed,
  MapPin,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  UserRound,
  X,
} from 'lucide-react';
import reneaLogo from '../assets/images/logo-renea-branco.png';
import type { PublicMaterialStock, PublicMaterialUseInput, PublicMaterialView } from '../publicApi';
import { fromPieces, pieceLength, toPieces } from '../modules/materials/materialPieces';
import { comprimirImagem, validarFoto } from '../utils/imagem';
import './presencaTempoRealPublica.css';

interface Props {
  loadView: () => Promise<PublicMaterialView>;
  submitUse: (input: PublicMaterialUseInput) => Promise<{ message: string; view?: PublicMaterialView; fotosFalharam?: boolean }>;
}

type Passo = 'material' | 'envio';
type Gps = { estado: 'buscando' | 'ativo' | 'negado' | 'indisponivel'; lat?: number; lng?: number; precisaoM?: number; em?: string };

const MAX_FOTOS = 3;
const NAME_KEY = 'renea_material_apontador_nome';
const PENDING_KEY = 'renea_material_envio_pendente';

const FOCO = 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f26a2e]/60';
const CARTAO = 'rounded-2xl border border-slate-200 bg-white';
const BOTAO_PRIMARIO = `inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#176b4d] px-5 text-base font-bold text-white transition active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-500 ${FOCO}`;
const BOTAO_SECUNDARIO = `inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 text-base font-bold text-slate-800 transition active:scale-[0.98] ${FOCO}`;

const readStorage = (key: string) => {
  try { return window.localStorage.getItem(key) || ''; } catch { return ''; }
};
const writeStorage = (key: string, value: string) => {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch { /* aparelho sem armazenamento: segue sem lembrar */ }
};

const newSubmissionId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

const shiftDate = (iso: string, days: number) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

const dayLabel = (iso: string, today: string) => {
  if (iso === today) return 'Hoje';
  if (iso === shiftDate(today, -1)) return 'Ontem';
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
};

const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const reduzMovimento = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** O apontador conta peça quando o material tem comprimento; senão, na unidade do cadastro. */
const countUnit = (item: PublicMaterialStock) => pieceLength(item) ? 'pç' : (item.unidade || '').toLowerCase().replace(/^mt$/, 'm');
const inCountUnit = (item: PublicMaterialStock, quantity: number) => toPieces(item, quantity) ?? quantity;
const usePercent = (item: PublicMaterialStock) => item.recebido > 0 ? Math.round((item.usado / item.recebido) * 100) : 0;

/** Os três passos no topo: onde a pessoa está e quanto falta. */
function Passos({ atual }: { atual: 1 | 2 | 3 }) {
  const nomes = ['Ramo', 'Material', 'Foto e envio'];
  return (
    <ol className="mb-5 grid grid-cols-3 gap-2" aria-label="Passos do apontamento">
      {nomes.map((nome, indice) => {
        const numero = indice + 1;
        const feito = numero < atual;
        const agora = numero === atual;
        return (
          <li key={nome} aria-current={agora ? 'step' : undefined} className="min-w-0">
            <span className={`block h-1.5 rounded-full ${feito || agora ? 'bg-[#176b4d]' : 'bg-slate-200'}`} />
            <span className={`mt-1.5 flex items-center gap-1 truncate text-xs font-bold ${agora ? 'text-[#176b4d]' : feito ? 'text-slate-700' : 'text-slate-400'}`}>
              {feito ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : <span aria-hidden="true">{numero}.</span>}
              {nome}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Titulo({ eyebrow, titulo, children }: { eyebrow: string; titulo: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4" data-material-reveal>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#176b4d]">{eyebrow}</p>
      <h1 className="mt-1 text-[1.75rem] font-black leading-tight text-slate-950 sm:text-4xl">{titulo}</h1>
      {children && <div className="mt-1.5 text-base text-slate-600">{children}</div>}
    </div>
  );
}

function BarraDeUso({ item }: { item: PublicMaterialStock }) {
  const percent = usePercent(item);
  const passou = item.usado > item.recebido;
  return (
    <div className="mt-2">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${percent}% já aplicado`}>
        <span className={`block h-full origin-left rounded-full ${passou ? 'bg-[#f26a2e]' : 'bg-[#176b4d]'}`} style={{ transform: `scaleX(${Math.min(100, percent) / 100})` }} />
      </div>
      <p className={`mt-1 text-xs font-semibold ${passou ? 'text-[#b3461a]' : 'text-slate-500'}`}>{percent}% já aplicado{passou ? ', passou do recebido' : ''}</p>
    </div>
  );
}

/** Câmera aberta dentro da página. Sem permissão ou sem câmera, avisa e a pessoa usa a galeria. */
function CameraNoApp({ onFoto, onFechar }: { onFoto: (arquivo: File) => void; onFechar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState('');
  const [pronta, setPronta] = useState(false);

  useEffect(() => {
    let fluxo: MediaStream | null = null;
    let cancelado = false;
    const abrir = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro('Este celular não abre a câmera por aqui. Use "Da galeria".');
        return;
      }
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 } }, audio: false });
        if (cancelado) { fluxo.getTracks().forEach(track => track.stop()); return; }
        if (video.current) {
          video.current.srcObject = fluxo;
          await video.current.play().catch(() => undefined);
          setPronta(true);
        }
      } catch {
        setErro('A câmera não foi liberada. Toque em permitir no aviso do celular ou use "Da galeria".');
      }
    };
    void abrir();
    const tecla = (event: KeyboardEvent) => { if (event.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', tecla);
    return () => {
      cancelado = true;
      fluxo?.getTracks().forEach(track => track.stop());
      document.removeEventListener('keydown', tecla);
    };
  }, [onFechar]);

  const tirar = () => {
    const elemento = video.current;
    if (!elemento || !elemento.videoWidth) return;
    const escala = Math.min(1, 1600 / elemento.videoWidth);
    const tela = document.createElement('canvas');
    tela.width = Math.round(elemento.videoWidth * escala);
    tela.height = Math.round(elemento.videoHeight * escala);
    tela.getContext('2d')?.drawImage(elemento, 0, 0, tela.width, tela.height);
    tela.toBlob(blob => {
      if (blob) onFoto(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      onFechar();
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Câmera">
      <div className="relative flex-1">
        <video ref={video} playsInline muted className="absolute inset-0 size-full object-cover" />
        {!pronta && !erro && <p className="absolute inset-0 grid place-items-center text-base font-semibold text-white/80">Abrindo a câmera...</p>}
        {erro && (
          <div className="absolute inset-x-4 top-1/3 rounded-2xl bg-white p-4 text-center">
            <AlertTriangle className="mx-auto size-8 text-[#f26a2e]" aria-hidden="true" />
            <p className="mt-2 text-base font-semibold text-slate-800">{erro}</p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
        <button type="button" onClick={onFechar} className={`justify-self-start rounded-2xl px-4 py-3 text-base font-bold text-white ${FOCO}`}>Fechar</button>
        <button
          type="button"
          onClick={tirar}
          disabled={!pronta}
          aria-label="Tirar a foto"
          className={`grid size-20 place-items-center rounded-full border-4 border-white bg-white/20 transition active:scale-95 disabled:opacity-40 ${FOCO}`}
        >
          <span className="size-14 rounded-full bg-white" />
        </button>
        <span />
      </div>
    </div>
  );
}

export default function MaterialLinkApontador({ loadView, submitUse }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const [view, setView] = useState<PublicMaterialView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [nome, setNome] = useState(() => readStorage(NAME_KEY));
  const [nomeRascunho, setNomeRascunho] = useState('');
  const [trocandoNome, setTrocandoNome] = useState(false);
  const [ramoId, setRamoId] = useState('');
  const [passo, setPasso] = useState<Passo>('material');
  const [busca, setBusca] = useState('');
  const [buscaMaterial, setBuscaMaterial] = useState('');
  const [data, setData] = useState('');
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState('');
  const [cameraAberta, setCameraAberta] = useState(false);
  const [gps, setGps] = useState<Gps>({ estado: 'buscando' });
  const [recibo, setRecibo] = useState<{ ramo: string; data: string; linhas: string[]; hora: string; fotos: number; fotosFalharam: boolean; comGps: boolean } | null>(null);
  const envioIdRef = useRef('');

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setLoading(true);
      setLoadError('');
    }
    try {
      const next = await loadView();
      setView(next);
      setData(current => current || next.dataAtual);
    } catch (error) {
      if (!silencioso) setLoadError(error instanceof Error ? error.message : 'Não foi possível abrir os materiais.');
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [loadView]);

  useEffect(() => { void carregar(); }, [carregar]);

  // Outra pessoa pode lançar no mesmo ramo. Ao voltar para a tela, o saldo
  // se atualiza sozinho, no máximo uma vez por minuto e só com a página visível.
  useEffect(() => {
    let ultima = Date.now();
    const atualizar = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine || Date.now() - ultima < 60_000) return;
      ultima = Date.now();
      void carregar(true);
    };
    document.addEventListener('visibilitychange', atualizar);
    window.addEventListener('online', atualizar);
    return () => {
      document.removeEventListener('visibilitychange', atualizar);
      window.removeEventListener('online', atualizar);
    };
  }, [carregar]);

  // GPS em tempo real enquanto a pessoa aponta: cada leitura nova substitui a
  // anterior e a última vai junto com o envio.
  useEffect(() => {
    if (!ramoId) return undefined;
    if (!('geolocation' in navigator)) {
      setGps({ estado: 'indisponivel' });
      return undefined;
    }
    setGps(atual => (atual.estado === 'ativo' ? atual : { estado: 'buscando' }));
    const id = navigator.geolocation.watchPosition(
      posicao => setGps({
        estado: 'ativo',
        lat: posicao.coords.latitude,
        lng: posicao.coords.longitude,
        precisaoM: Math.round(posicao.coords.accuracy),
        em: new Date(posicao.timestamp || Date.now()).toISOString(),
      }),
      erro => setGps(atual => (atual.estado === 'ativo' ? atual : { estado: erro.code === erro.PERMISSION_DENIED ? 'negado' : 'indisponivel' })),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [ramoId]);

  const ramo = view?.ramos.find(item => item.id === ramoId) || null;

  useGSAP(() => {
    if (!rootRef.current || reduzMovimento()) return;
    gsap.fromTo(rootRef.current.querySelectorAll('[data-material-reveal]'), { opacity: 0, y: 14 }, {
      opacity: 1, y: 0, duration: 0.42, stagger: 0.045, ease: 'power3.out', clearProps: 'transform,opacity',
    });
  }, { scope: rootRef, dependencies: [ramoId, passo, Boolean(view), Boolean(recibo), Boolean(nome)] });

  // A foto recém-tirada entra com um pulo curto: confirma que ela ficou.
  useGSAP(() => {
    if (!rootRef.current || fotos.length === 0 || reduzMovimento()) return;
    const ultima = rootRef.current.querySelector('[data-foto]:last-of-type');
    if (ultima) gsap.fromTo(ultima, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.38, ease: 'back.out(1.8)', clearProps: 'transform,opacity' });
  }, { scope: rootRef, dependencies: [fotos.length] });

  const receberFoto = async (arquivo?: File) => {
    if (!arquivo || fotos.length >= MAX_FOTOS) return;
    setErroFoto('');
    setPreparandoFoto(true);
    try {
      const foto = await comprimirImagem(arquivo);
      const problema = foto.startsWith('data:image/jpeg') ? validarFoto(foto) : 'Essa foto veio num formato que o sistema não aceita. Tire com a câmera.';
      if (problema) setErroFoto(problema);
      else setFotos(atuais => [...atuais, foto].slice(0, MAX_FOTOS));
    } catch {
      setErroFoto('Não foi possível ler a foto. Tire de novo.');
    } finally {
      setPreparandoFoto(false);
    }
  };
  const fecharCamera = useCallback(() => setCameraAberta(false), []);

  const ramosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return (view?.ramos || []).filter(item => !termo || item.nome.toLocaleLowerCase('pt-BR').includes(termo)
      || item.materiais.some(material => material.descricao.toLocaleLowerCase('pt-BR').includes(termo)));
  }, [busca, view]);

  // O que ainda tem saldo vem primeiro: é o que se aplica hoje.
  const materiaisDoRamo = useMemo(() => {
    const termo = buscaMaterial.trim().toLocaleLowerCase('pt-BR');
    return [...(ramo?.materiais || [])]
      .filter(item => !termo || item.descricao.toLocaleLowerCase('pt-BR').includes(termo))
      .sort((a, b) => Number(b.saldo > 0) - Number(a.saldo > 0) || a.descricao.localeCompare(b.descricao, 'pt-BR', { numeric: true }));
  }, [buscaMaterial, ramo]);

  const lancadosNoRamo = useMemo(() => (view?.lancamentosHoje || []).filter(item => item.ramoId === ramoId), [ramoId, view]);

  const itensMarcados = useMemo(() => (ramo?.materiais || [])
    .filter(item => escolhidos.includes(item.materialId))
    .map(item => ({ item, contagem: Number(String(quantidades[item.materialId] || '').replace(',', '.')) }))
    .filter(entry => Number.isFinite(entry.contagem) && entry.contagem > 0), [escolhidos, quantidades, ramo]);

  const ajustar = (item: PublicMaterialStock, delta: number) => {
    setErroEnvio('');
    setQuantidades(current => {
      const atual = Number(String(current[item.materialId] || '0').replace(',', '.')) || 0;
      const proximo = Math.max(0, Number((atual + delta).toFixed(2)));
      return { ...current, [item.materialId]: proximo ? String(proximo).replace('.', ',') : '' };
    });
  };

  const digitar = (item: PublicMaterialStock, value: string) => {
    setErroEnvio('');
    const limpo = value.replace(/[^0-9,.]/g, '').replace(/([,.].*)[,.]/, '$1').slice(0, 9);
    setQuantidades(current => ({ ...current, [item.materialId]: limpo }));
  };

  const alternarMaterial = (item: PublicMaterialStock) => {
    setErroEnvio('');
    setEscolhidos(atuais => {
      if (atuais.includes(item.materialId)) {
        setQuantidades(current => ({ ...current, [item.materialId]: '' }));
        return atuais.filter(id => id !== item.materialId);
      }
      // Escolher já marca 1: quase sempre é o que se aplicou.
      setQuantidades(current => ({ ...current, [item.materialId]: current[item.materialId] || '1' }));
      return [...atuais, item.materialId];
    });
  };

  const limparApontamento = () => {
    setEscolhidos([]);
    setQuantidades({});
    setFotos([]);
    setErroFoto('');
    setErroEnvio('');
    setBuscaMaterial('');
  };

  const abrirRamo = (id: string) => {
    setRamoId(id);
    setPasso('material');
    limparApontamento();
    setRecibo(null);
    if (view) setData(view.dataAtual);
    window.scrollTo({ top: 0 });
  };

  const irPara = (proximo: Passo) => {
    setPasso(proximo);
    window.scrollTo({ top: 0 });
  };

  const salvarNome = () => {
    const limpo = nomeRascunho.trim().replace(/\s+/g, ' ');
    if (limpo.length < 2) return;
    writeStorage(NAME_KEY, limpo);
    setNome(limpo);
    setTrocandoNome(false);
  };

  const enviar = async () => {
    if (!ramo || itensMarcados.length === 0 || enviando) return;
    // O mesmo identificador vale até o envio dar certo: se a rede cair depois
    // de gravar, tocar de novo não conta o uso duas vezes.
    const pendente = readStorage(PENDING_KEY);
    envioIdRef.current = envioIdRef.current || pendente || newSubmissionId();
    writeStorage(PENDING_KEY, envioIdRef.current);
    setEnviando(true);
    setErroEnvio('');
    const local = gps.estado === 'ativo' && gps.lat !== undefined && gps.lng !== undefined
      ? { lat: gps.lat, lng: gps.lng, precisaoM: gps.precisaoM ?? 0, em: gps.em || new Date().toISOString() }
      : undefined;
    try {
      const resposta = await submitUse({
        envioId: envioIdRef.current,
        data: data || view?.dataAtual || '',
        etapaServicoId: ramo.id,
        apontador: nome,
        itens: itensMarcados.map(({ item, contagem }) => ({ materialId: item.materialId, quantidade: fromPieces(item, contagem) })),
        fotos: fotos.length ? fotos : undefined,
        local,
      });
      envioIdRef.current = '';
      writeStorage(PENDING_KEY, '');
      setRecibo({
        ramo: ramo.nome,
        data: data || view?.dataAtual || '',
        linhas: itensMarcados.map(({ item, contagem }) => `${number(contagem)} ${countUnit(item)} de ${item.descricao}`),
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        fotos: fotos.length,
        fotosFalharam: Boolean(resposta.fotosFalharam),
        comGps: Boolean(local),
      });
      limparApontamento();
      setPasso('material');
      if (resposta.view) setView(resposta.view);
      window.scrollTo({ top: 0 });
    } catch (error) {
      setErroEnvio(error instanceof Error ? error.message : 'Não foi possível salvar. Confira a internet e toque de novo.');
    } finally {
      setEnviando(false);
    }
  };

  const voltar = () => {
    if (passo === 'envio') irPara('material');
    else setRamoId('');
  };

  const header = (aoVoltar?: () => void) => (
    <header className="presence-public__header">
      <button type="button" onClick={aoVoltar} aria-label="Voltar" disabled={!aoVoltar}><ArrowLeft className="h-5 w-5" /></button>
      <img src={reneaLogo} alt="RENEA Infraestrutura" className="presence-public__logo" />
      <span><i /> Ao vivo</span>
    </header>
  );

  const conteudo = 'mx-auto w-full max-w-xl px-4 pb-40 pt-5 sm:px-6';

  if (loading && !view) {
    return (
      <main className="presence-public presence-public--center">
        <section className="presence-public__loading" aria-busy="true">
          <img src={reneaLogo} alt="RENEA Infraestrutura" className="presence-public__logo" />
          <div className="presence-public__loading-line" />
          <div className="presence-public__loading-line presence-public__loading-line--short" />
          <p>Preparando os materiais recebidos</p>
        </section>
      </main>
    );
  }

  if (loadError && !view) {
    return (
      <main className="presence-public presence-public--center">
        <section className="presence-public__state-card">
          <AlertTriangle className="presence-public__state-icon presence-public__state-icon--warning" />
          <h1>Não foi possível abrir os materiais</h1>
          <p>{loadError}</p>
          <button type="button" onClick={() => void carregar()} className="presence-public__primary"><RefreshCw className="h-4 w-4" /> Tentar novamente</button>
        </section>
      </main>
    );
  }

  if (!nome || trocandoNome) {
    return (
      <main ref={rootRef} className="presence-public">
        {header(trocandoNome ? () => setTrocandoNome(false) : undefined)}
        <div className={conteudo}>
          <Titulo eyebrow="Registro de campo" titulo="Quem está apontando?">
            Seu nome fica em cada lançamento. O celular lembra dele depois.
          </Titulo>
          <form className={`${CARTAO} grid gap-3 p-4`} data-material-reveal onSubmit={event => { event.preventDefault(); salvarNome(); }}>
            <label htmlFor="material-link-nome" className="text-sm font-bold text-slate-700">Seu nome</label>
            <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 focus-within:border-[#176b4d] focus-within:ring-4 focus-within:ring-[#f26a2e]/40">
              <UserRound className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                id="material-link-nome"
                autoFocus
                autoComplete="name"
                enterKeyHint="done"
                value={nomeRascunho}
                onChange={event => setNomeRascunho(event.target.value)}
                placeholder="Ex.: Carlos Menezes"
                className="min-w-0 flex-1 bg-transparent text-lg text-slate-900 outline-none placeholder:text-slate-400 focus-visible:outline-none"
              />
            </div>
            <button type="submit" className={BOTAO_PRIMARIO} disabled={nomeRascunho.trim().length < 2}>
              Continuar <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (recibo) {
    return (
      <main ref={rootRef} className="presence-public">
        {header()}
        <div className={conteudo}>
          <section className={`${CARTAO} p-5 text-center`} data-material-reveal>
            <CheckCircle2 className="mx-auto size-14 text-[#176b4d]" aria-hidden="true" />
            <h1 className="mt-2 text-2xl font-black text-slate-950">Uso salvo</h1>
            <p className="mt-1 text-base text-slate-600">{recibo.ramo} · {dayLabel(recibo.data, view?.dataAtual || recibo.data)} · às {recibo.hora}</p>
            <ul className="mt-4 grid gap-2 text-left">
              {recibo.linhas.map(linha => (
                <li key={linha} className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-base text-slate-800"><Package className="mt-0.5 size-5 shrink-0 text-[#176b4d]" aria-hidden="true" />{linha}</li>
              ))}
              {recibo.fotos > 0 && !recibo.fotosFalharam && (
                <li className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-base text-slate-800"><Camera className="size-5 shrink-0 text-[#176b4d]" aria-hidden="true" />{recibo.fotos} {recibo.fotos === 1 ? 'foto enviada' : 'fotos enviadas'}</li>
              )}
              <li className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-base text-slate-800"><MapPin className="size-5 shrink-0 text-[#176b4d]" aria-hidden="true" />{recibo.comGps ? 'Local do GPS enviado' : 'Enviado sem GPS'}</li>
            </ul>
            {recibo.fotosFalharam && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-left text-sm font-semibold text-amber-900" role="status">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#f26a2e]" aria-hidden="true" /> O uso foi salvo, mas as fotos não chegaram. Avise o escritório.
              </p>
            )}
            <div className="mt-5 grid gap-2">
              <button type="button" className={BOTAO_PRIMARIO} onClick={() => setRecibo(null)}>Apontar mais neste ramo</button>
              <button type="button" className={BOTAO_SECUNDARIO} onClick={() => { setRecibo(null); setRamoId(''); }}>Trocar de ramo</button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!ramo) {
    return (
      <main ref={rootRef} className="presence-public">
        {header()}
        <div className={conteudo}>
          <Passos atual={1} />
          <Titulo eyebrow="Registro de campo" titulo="Em qual ramo?">
            Apontando como <strong className="text-slate-900">{nome}</strong>.{' '}
            <button type="button" className={`rounded font-bold text-[#176b4d] underline underline-offset-4 ${FOCO}`} onClick={() => { setNomeRascunho(nome); setTrocandoNome(true); }}>Trocar nome</button>
          </Titulo>
          {(view?.ramos.length || 0) > 5 && (
            <label className="mb-3 flex min-h-14 items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 focus-within:border-[#176b4d] focus-within:ring-4 focus-within:ring-[#f26a2e]/40" data-material-reveal>
              <Search className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="sr-only">Buscar ramo ou material</span>
              <input inputMode="search" enterKeyHint="search" autoComplete="off" value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar ramo ou material" className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 focus-visible:outline-none" />
            </label>
          )}
          <ul className="grid gap-2.5">
            {ramosFiltrados.length === 0 ? (
              <li className={`${CARTAO} p-5 text-center text-base text-slate-600`}>
                {(view?.ramos.length || 0) === 0 ? 'Nenhum material recebido está ligado a um ramo ainda. Avise o escritório.' : 'Nenhum ramo encontrado.'}
              </li>
            ) : ramosFiltrados.map(item => {
              const lancadosHoje = (view?.lancamentosHoje || []).filter(uso => uso.ramoId === item.id).length;
              return (
                <li key={item.id} data-material-reveal>
                  <button type="button" data-ramo onClick={() => abrirRamo(item.id)} className={`${CARTAO} flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-3 text-left transition hover:border-[#176b4d] active:scale-[0.99] ${FOCO}`}>
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#176b4d]"><MapPin className="size-5" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-lg font-bold text-slate-950">{item.nome}</strong>
                      <span className="block text-sm text-slate-500">
                        {item.materiais.length} {item.materiais.length === 1 ? 'material' : 'materiais'}
                        {lancadosHoje ? ` · ${lancadosHoje} ${lancadosHoje === 1 ? 'lançamento' : 'lançamentos'} hoje` : ''}
                      </span>
                    </span>
                    <ChevronRight className="size-6 shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    );
  }

  const hoje = view?.dataAtual || '';
  const ontem = hoje ? shiftDate(hoje, -1) : '';
  const semQuantidade = escolhidos.length > 0 && itensMarcados.length < escolhidos.length;

  if (passo === 'material') {
    return (
      <main ref={rootRef} className="presence-public">
        {header(voltar)}
        <div className={conteudo}>
          <Passos atual={2} />
          <Titulo eyebrow={ramo.nome} titulo="O que foi usado?">Toque no material e diga quanto usou.</Titulo>
          {ramo.materiais.length > 6 && (
            <label className="mb-3 flex min-h-14 items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 focus-within:border-[#176b4d] focus-within:ring-4 focus-within:ring-[#f26a2e]/40" data-material-reveal>
              <Search className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="sr-only">Buscar material</span>
              <input inputMode="search" autoComplete="off" value={buscaMaterial} onChange={event => setBuscaMaterial(event.target.value)} placeholder="Buscar material" className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 focus-visible:outline-none" />
            </label>
          )}
          <ul className="grid gap-2.5">
            {materiaisDoRamo.map(item => {
              const unidade = countUnit(item);
              const escolhido = escolhidos.includes(item.materialId);
              const valor = quantidades[item.materialId] || '';
              const marcado = Number(valor.replace(',', '.')) || 0;
              const saldo = inCountUnit(item, item.saldo);
              return (
                <li key={item.materialId} data-material-reveal className={`${CARTAO} overflow-hidden transition ${escolhido ? 'border-[#176b4d] ring-2 ring-[#176b4d]/15' : ''}`}>
                  <button type="button" aria-pressed={escolhido} onClick={() => alternarMaterial(item)} className={`flex w-full items-start gap-3 p-4 text-left ${FOCO}`}>
                    <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border-2 ${escolhido ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-300 bg-white'}`}>
                      {escolhido && <Check className="size-4" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-base font-bold leading-snug text-slate-950">{item.descricao}</strong>
                      <span className="mt-0.5 block text-sm text-slate-600">
                        {saldo > 0 ? <>Sobram <strong className="text-slate-900">{number(saldo)} {unidade}</strong> de {number(inCountUnit(item, item.recebido))}</> : <>Tudo aplicado ({number(inCountUnit(item, item.recebido))} {unidade})</>}
                      </span>
                      <BarraDeUso item={item} />
                    </span>
                  </button>
                  {escolhido && (
                    <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="mb-2 text-sm font-bold text-slate-700">Quanto usou?</p>
                      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-center gap-2">
                        <button type="button" onClick={() => ajustar(item, -1)} disabled={marcado <= 0} aria-label={`Diminuir ${item.descricao}`} className={`grid h-14 place-items-center rounded-2xl border border-slate-300 bg-white text-slate-700 disabled:opacity-40 ${FOCO}`}><Minus className="size-6" aria-hidden="true" /></button>
                        <label className="flex h-14 items-baseline justify-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-3 focus-within:border-[#176b4d] focus-within:ring-4 focus-within:ring-[#f26a2e]/40">
                          <span className="sr-only">Quantidade usada de {item.descricao} em {unidade}</span>
                          <input
                            inputMode="decimal"
                            enterKeyHint="done"
                            value={valor}
                            placeholder="0"
                            onChange={event => digitar(item, event.target.value)}
                            onFocus={event => event.target.select()}
                            className="h-full w-full min-w-0 bg-transparent text-right text-2xl font-black tabular-nums text-slate-950 outline-none focus-visible:outline-none"
                          />
                          <small className="text-base font-bold text-slate-500">{unidade}</small>
                        </label>
                        <button type="button" onClick={() => ajustar(item, 1)} aria-label={`Aumentar ${item.descricao}`} className={`grid h-14 place-items-center rounded-2xl bg-[#176b4d] text-white ${FOCO}`}><Plus className="size-6" aria-hidden="true" /></button>
                      </div>
                      {marcado > saldo && (
                        <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-[#b3461a]" role="status"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> Passa do que sobrou neste ramo. Pode seguir: o escritório confere.</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {materiaisDoRamo.length === 0 && <li className={`${CARTAO} p-5 text-center text-base text-slate-600`}>Nenhum material com esse nome.</li>}
          </ul>

          {lancadosNoRamo.length > 0 && (
            <section className="mt-6" data-material-reveal aria-labelledby="material-link-hoje">
              <h2 id="material-link-hoje" className="mb-2 text-sm font-bold uppercase tracking-wide text-[#718087]">Já lançado hoje neste ramo</h2>
              <ul className={`${CARTAO} divide-y divide-slate-100`}>
                {lancadosNoRamo.slice(0, 12).map(uso => {
                  const material = ramo.materiais.find(item => item.materialId === uso.materialId);
                  const hora = uso.criadoEm ? new Date(uso.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <li key={uso.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="min-w-0 text-slate-700"><strong className="text-slate-950">{material ? `${number(inCountUnit(material, uso.quantidade))} ${countUnit(material)}` : number(uso.quantidade)}</strong> · {material?.descricao || 'Material'}</span>
                      <span className="shrink-0 text-xs text-slate-500">{[uso.apontador, hora].filter(Boolean).join(' às ')}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white px-4 sm:px-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex w-full max-w-xl items-center gap-3 sm:px-6">
            <p className="min-w-0 flex-1 text-sm text-slate-600">
              <strong className="block text-base text-slate-950">{itensMarcados.length === 0 ? 'Nada escolhido' : `${itensMarcados.length} ${itensMarcados.length === 1 ? 'material' : 'materiais'}`}</strong>
              {semQuantidade ? 'Falta a quantidade' : ramo.nome}
            </p>
            <button type="button" className={`${BOTAO_PRIMARIO} shrink-0`} disabled={itensMarcados.length === 0} onClick={() => irPara('envio')}>
              Continuar <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </main>
    );
  }

  const gpsTexto = gps.estado === 'ativo'
    ? `Localização ativa, precisão de ${number(gps.precisaoM ?? 0)} m`
    : gps.estado === 'buscando' ? 'Procurando o sinal do GPS...'
      : gps.estado === 'negado' ? 'GPS bloqueado. Libere a localização no celular para mandar junto.'
        : 'Este celular não informou o GPS. Pode salvar sem ele.';

  return (
    <main ref={rootRef} className="presence-public">
      {header(voltar)}
      {cameraAberta && <CameraNoApp onFoto={arquivo => void receberFoto(arquivo)} onFechar={fecharCamera} />}
      <form className={conteudo} onSubmit={event => { event.preventDefault(); void enviar(); }}>
        <Passos atual={3} />
        <Titulo eyebrow={ramo.nome} titulo="Foto e envio">Confira, tire a foto se quiser e salve.</Titulo>

        <section className={`${CARTAO} p-4`} data-material-reveal aria-labelledby="material-link-resumo">
          <div className="flex items-center justify-between gap-3">
            <h2 id="material-link-resumo" className="text-base font-bold text-slate-950">O que foi usado</h2>
            <button type="button" onClick={() => irPara('material')} className={`rounded-lg px-2 py-1 text-sm font-bold text-[#176b4d] underline underline-offset-4 ${FOCO}`}>Alterar</button>
          </div>
          <ul className="mt-2 divide-y divide-slate-100">
            {itensMarcados.map(({ item, contagem }) => (
              <li key={item.materialId} className="flex items-baseline justify-between gap-3 py-2 text-base">
                <span className="min-w-0 text-slate-700">{item.descricao}</span>
                <strong className="shrink-0 tabular-nums text-slate-950">{number(contagem)} {countUnit(item)}</strong>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Dia do uso">
            {[hoje, ontem].filter(Boolean).map(dia => (
              <button
                key={dia}
                type="button"
                aria-pressed={dia === data}
                onClick={() => setData(dia)}
                className={`min-h-12 rounded-2xl border text-base font-bold transition ${FOCO} ${dia === data ? 'border-[#176b4d] bg-[#176b4d] text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                Usado {dayLabel(dia, hoje).toLocaleLowerCase('pt-BR')}
              </button>
            ))}
          </div>
        </section>

        <section className={`${CARTAO} mt-3 p-4`} data-material-reveal aria-labelledby="material-link-fotos">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="material-link-fotos" className="text-base font-bold text-slate-950">Fotos do serviço</h2>
            <span className="text-sm text-slate-500">Opcional · até {MAX_FOTOS}</span>
          </div>
          {fotos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {fotos.map((foto, index) => (
                <figure key={foto.slice(-40)} data-foto className="relative aspect-square overflow-hidden rounded-xl border border-slate-200">
                  <img src={foto} alt={`Foto ${index + 1} do serviço`} className="size-full object-cover" />
                  <button type="button" onClick={() => setFotos(atuais => atuais.filter((_, i) => i !== index))} aria-label={`Tirar a foto ${index + 1}`} className={`absolute right-1 top-1 grid size-9 place-items-center rounded-full bg-black/60 text-white ${FOCO}`}><X className="size-5" aria-hidden="true" /></button>
                </figure>
              ))}
            </div>
          )}
          {fotos.length < MAX_FOTOS && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setCameraAberta(true)} disabled={preparandoFoto} className={`${BOTAO_SECUNDARIO} flex-col gap-1 py-3`}>
                <Camera className="size-6 text-[#176b4d]" aria-hidden="true" />
                <span>Câmera aqui</span>
              </button>
              <label className={`${BOTAO_SECUNDARIO} cursor-pointer flex-col gap-1 py-3 focus-within:ring-4 focus-within:ring-[#f26a2e]/60`}>
                {preparandoFoto ? <RefreshCw className="size-6 animate-spin text-[#176b4d]" aria-hidden="true" /> : <Images className="size-6 text-[#176b4d]" aria-hidden="true" />}
                <span>{preparandoFoto ? 'Preparando' : 'Da galeria'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={preparandoFoto}
                  onChange={event => { void receberFoto(event.target.files?.[0]); event.target.value = ''; }}
                />
              </label>
            </div>
          )}
          {erroFoto && <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-[#b3461a]" role="alert"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {erroFoto}</p>}
        </section>

        <section className={`${CARTAO} mt-3 p-4`} data-material-reveal aria-live="polite" aria-labelledby="material-link-gps">
          <div className="flex items-start gap-3">
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${gps.estado === 'ativo' ? 'bg-emerald-50 text-[#176b4d]' : 'bg-amber-50 text-[#f26a2e]'}`}>
              <LocateFixed className={`size-5 ${gps.estado === 'buscando' ? 'animate-pulse' : ''}`} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="material-link-gps" className="text-base font-bold text-slate-950">Local do GPS</h2>
              <p className="text-sm text-slate-600">{gpsTexto}</p>
              {gps.estado === 'ativo' && gps.lat !== undefined && gps.lng !== undefined && (
                <a href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`} target="_blank" rel="noreferrer" className={`mt-1 inline-flex items-center gap-1 rounded text-sm font-bold text-[#176b4d] underline underline-offset-4 ${FOCO}`}>
                  <MapPin className="size-4" aria-hidden="true" /> Ver no mapa
                </a>
              )}
            </div>
          </div>
        </section>

        {erroEnvio && <div role="alert" className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-base font-semibold text-rose-800"><AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> {erroEnvio}</div>}

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white px-4 sm:px-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex w-full max-w-xl items-center gap-3 sm:px-6">
            <p className="min-w-0 flex-1 text-sm text-slate-600">
              <strong className="block text-base text-slate-950">{itensMarcados.length} {itensMarcados.length === 1 ? 'material' : 'materiais'}</strong>
              {dayLabel(data || hoje, hoje)}{fotos.length ? ` · ${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'}` : ''}{gps.estado === 'ativo' ? ' · GPS' : ''}
            </p>
            <button type="submit" className={`${BOTAO_PRIMARIO} shrink-0`} disabled={enviando || preparandoFoto || itensMarcados.length === 0}>
              {enviando ? <RefreshCw className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
              {enviando ? 'Salvando' : 'Salvar uso'}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
