import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  UserRound,
} from 'lucide-react';
import reneaLogo from '../assets/images/logo-renea-branco.png';
import type { PublicMaterialStock, PublicMaterialUseInput, PublicMaterialView } from '../publicApi';
import { formatMaterialQuantity, fromPieces, pieceLength, toPieces } from '../modules/materials/materialPieces';
import './presencaTempoRealPublica.css';
import './materialLinkApontador.css';

interface Props {
  loadView: () => Promise<PublicMaterialView>;
  submitUse: (input: PublicMaterialUseInput) => Promise<{ message: string; view?: PublicMaterialView }>;
}

const NAME_KEY = 'renea_material_apontador_nome';
const PENDING_KEY = 'renea_material_envio_pendente';

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
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

const dayLabel = (iso: string, today: string) => {
  if (iso === today) return 'Hoje';
  if (iso === shiftDate(today, -1)) return 'Ontem';
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
};

const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** O apontador conta peça quando o material tem comprimento; senão, na unidade do cadastro. */
const countUnit = (item: PublicMaterialStock) => pieceLength(item) ? 'pç' : (item.unidade || '').toLowerCase().replace(/^mt$/, 'm');
const inCountUnit = (item: PublicMaterialStock, quantity: number) => toPieces(item, quantity) ?? quantity;

const usePercent = (item: PublicMaterialStock) => item.recebido > 0 ? Math.round((item.usado / item.recebido) * 100) : 0;

export default function MaterialLinkApontador({ loadView, submitUse }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const [view, setView] = useState<PublicMaterialView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [nome, setNome] = useState(() => readStorage(NAME_KEY));
  const [nomeRascunho, setNomeRascunho] = useState('');
  const [trocandoNome, setTrocandoNome] = useState(false);
  const [ramoId, setRamoId] = useState('');
  const [busca, setBusca] = useState('');
  const [data, setData] = useState('');
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [recibo, setRecibo] = useState<{ ramo: string; data: string; linhas: string[]; hora: string } | null>(null);
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

  const ramo = view?.ramos.find(item => item.id === ramoId) || null;

  useGSAP(() => {
    if (!rootRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(rootRef.current.querySelectorAll('[data-material-reveal]'), { opacity: 0, y: 14 }, {
      opacity: 1, y: 0, duration: 0.42, stagger: 0.045, ease: 'power3.out', clearProps: 'transform,opacity',
    });
  }, { scope: rootRef, dependencies: [ramoId, Boolean(view), Boolean(recibo), Boolean(nome)] });

  const ramosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return (view?.ramos || []).filter(item => !termo || item.nome.toLocaleLowerCase('pt-BR').includes(termo)
      || item.materiais.some(material => material.descricao.toLocaleLowerCase('pt-BR').includes(termo)));
  }, [busca, view]);

  const lancadosNoRamo = useMemo(() => (view?.lancamentosHoje || []).filter(item => item.ramoId === ramoId), [ramoId, view]);

  const itensMarcados = useMemo(() => (ramo?.materiais || [])
    .map(item => ({ item, contagem: Number(String(quantidades[item.materialId] || '').replace(',', '.')) }))
    .filter(entry => Number.isFinite(entry.contagem) && entry.contagem > 0), [quantidades, ramo]);

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

  const abrirRamo = (id: string) => {
    setRamoId(id);
    setQuantidades({});
    setErroEnvio('');
    setRecibo(null);
    if (view) setData(view.dataAtual);
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
    try {
      const resposta = await submitUse({
        envioId: envioIdRef.current,
        data: data || view?.dataAtual || '',
        etapaServicoId: ramo.id,
        apontador: nome,
        itens: itensMarcados.map(({ item, contagem }) => ({ materialId: item.materialId, quantidade: fromPieces(item, contagem) })),
      });
      envioIdRef.current = '';
      writeStorage(PENDING_KEY, '');
      setRecibo({
        ramo: ramo.nome,
        data: data || view?.dataAtual || '',
        linhas: itensMarcados.map(({ item, contagem }) => `${number(contagem)} ${countUnit(item)} de ${item.descricao}`),
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      });
      setQuantidades({});
      if (resposta.view) setView(resposta.view);
      window.scrollTo({ top: 0 });
    } catch (error) {
      setErroEnvio(error instanceof Error ? error.message : 'Não foi possível salvar. Confira a internet e toque de novo.');
    } finally {
      setEnviando(false);
    }
  };

  const header = (voltar?: () => void) => (
    <header className="presence-public__header">
      <button type="button" onClick={voltar} aria-label="Voltar aos ramos" disabled={!voltar}><ArrowLeft className="h-5 w-5" /></button>
      <img src={reneaLogo} alt="RENEA Infraestrutura" className="presence-public__logo" />
      <span><i /> Ao vivo</span>
    </header>
  );

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
        <div className="presence-public__content presence-public__content--narrow">
          <section className="presence-public__intro" data-material-reveal>
            <p className="presence-public__eyebrow">Registro de campo</p>
            <h1>Quem está apontando?</h1>
            <p>Seu nome fica em cada lançamento. O celular lembra dele depois.</p>
          </section>
          <form
            className="material-link__name-card"
            data-material-reveal
            onSubmit={event => { event.preventDefault(); salvarNome(); }}
          >
            <label htmlFor="material-link-nome">Seu nome</label>
            <div className="presence-public__search">
              <UserRound className="h-5 w-5" />
              <input
                id="material-link-nome"
                autoFocus
                autoComplete="name"
                enterKeyHint="done"
                value={nomeRascunho}
                onChange={event => setNomeRascunho(event.target.value)}
                placeholder="Ex.: Carlos Menezes"
              />
            </div>
            <button type="submit" className="material-link__primary" disabled={nomeRascunho.trim().length < 2}>
              Continuar <ChevronRight className="h-5 w-5" />
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (!ramo) {
    return (
      <main ref={rootRef} className="presence-public">
        {header()}
        <div className="presence-public__content presence-public__content--narrow">
          <section className="presence-public__intro" data-material-reveal>
            <p className="presence-public__eyebrow">Registro de campo</p>
            <h1>Onde foi aplicado?</h1>
            <p>
              Apontando como <strong>{nome}</strong>.{' '}
              <button type="button" className="material-link__inline-link" onClick={() => { setNomeRascunho(nome); setTrocandoNome(true); }}>Trocar nome</button>
            </p>
          </section>
          {(view?.ramos.length || 0) > 5 && (
            <>
              <div className="presence-public__search" data-material-reveal><Search className="h-5 w-5" /><input inputMode="search" enterKeyHint="search" autoComplete="off" value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar ramo ou material" aria-label="Buscar ramo ou material" /></div>
              <p className="presence-public__search-meta" aria-live="polite">{ramosFiltrados.length} {ramosFiltrados.length === 1 ? 'ramo encontrado' : 'ramos encontrados'}</p>
            </>
          )}
          <section className="presence-public__group-list">
            {ramosFiltrados.length === 0 ? (
              <p className="presence-public__empty">
                {(view?.ramos.length || 0) === 0
                  ? 'Nenhum material recebido está vinculado a um ramo ainda. Avise o escritório.'
                  : 'Nenhum ramo encontrado.'}
              </p>
            ) : ramosFiltrados.map(item => {
              const lancadosHoje = (view?.lancamentosHoje || []).filter(uso => uso.ramoId === item.id).length;
              return (
                <button key={item.id} type="button" data-material-reveal onClick={() => abrirRamo(item.id)} className="presence-public__group-button">
                  <div>
                    <strong>{item.nome}</strong>
                    <span>{item.materiais.length} {item.materiais.length === 1 ? 'material recebido' : 'materiais recebidos'}{lancadosHoje ? ` · ${lancadosHoje} ${lancadosHoje === 1 ? 'lançamento' : 'lançamentos'} hoje` : ''}</span>
                  </div>
                  <ChevronRight className="h-5 w-5" />
                </button>
              );
            })}
          </section>
        </div>
      </main>
    );
  }

  if (recibo) {
    return (
      <main ref={rootRef} className="presence-public presence-public--center">
        <section className="presence-public__success-card" data-material-reveal>
          <CheckCircle2 className="presence-public__success-icon" />
          <h1>Uso salvo</h1>
          <p>{recibo.ramo} · {dayLabel(recibo.data, view?.dataAtual || recibo.data)} · às {recibo.hora}</p>
          <ul className="material-link__receipt">
            {recibo.linhas.map(linha => <li key={linha}><Package className="h-4 w-4" />{linha}</li>)}
          </ul>
          <div className="material-link__receipt-actions">
            <button type="button" className="material-link__primary" onClick={() => setRecibo(null)}>Apontar mais neste ramo</button>
            <button type="button" className="material-link__secondary" onClick={() => { setRecibo(null); setRamoId(''); }}>Trocar de ramo</button>
          </div>
        </section>
      </main>
    );
  }

  const hoje = view?.dataAtual || '';
  const ontem = hoje ? shiftDate(hoje, -1) : '';
  const totalMarcado = itensMarcados.reduce((soma, entry) => soma + entry.contagem, 0);
  const unidadesMarcadas = new Set(itensMarcados.map(entry => countUnit(entry.item)));

  return (
    <main ref={rootRef} className="presence-public">
      {header(() => setRamoId(''))}
      <div className="presence-public__content">
        <section className="presence-public__intro presence-public__intro--form" data-material-reveal>
          <p className="presence-public__eyebrow">Registro de campo</p>
          <h1>Apontar uso</h1>
          <p>{ramo.nome} · {nome}</p>
        </section>

        <section className="presence-public__daybar material-link__daybar" aria-label="Dia do uso" data-material-reveal>
          {[hoje, ontem].filter(Boolean).map(dia => (
            <button
              key={dia}
              type="button"
              className="presence-public__day"
              data-selected={dia === data}
              aria-pressed={dia === data}
              onClick={() => setData(dia)}
            >
              {dayLabel(dia, hoje)}
            </button>
          ))}
        </section>

        <form className="presence-public__form" onSubmit={event => { event.preventDefault(); void enviar(); }}>
          <section className="presence-public__employee-list">
            {/* O que ainda tem saldo vem primeiro: é o que se aplica hoje. */}
            {[...ramo.materiais].sort((a, b) => Number(b.saldo > 0) - Number(a.saldo > 0)).map(item => {
              const unidade = countUnit(item);
              const recebido = inCountUnit(item, item.recebido);
              const saldo = inCountUnit(item, item.saldo);
              const percent = usePercent(item);
              const valor = quantidades[item.materialId] || '';
              const marcado = Number(valor.replace(',', '.')) || 0;
              const excede = marcado > 0 && marcado > saldo;
              return (
                <article key={item.materialId} className="presence-public__employee-card material-link__card" data-material-reveal data-marked={marcado > 0 || undefined}>
                  <div className="material-link__card-head">
                    <h2>{item.descricao}</h2>
                    <p>
                      {saldo > 0 ? <>Sobram <strong>{number(saldo)} {unidade}</strong> de {number(recebido)}</> : <>Tudo aplicado: {number(recebido)} {unidade}</>}
                    </p>
                  </div>
                  <div
                    className="material-link__usage"
                    role="img"
                    aria-label={`${percent}% já aplicado`}
                    title={`${formatMaterialQuantity(item, item.usado)} aplicados de ${formatMaterialQuantity(item, item.recebido)}`}
                  >
                    <i style={{ transform: `scaleX(${Math.min(100, percent) / 100})` }} data-over={item.usado > item.recebido || undefined} />
                  </div>
                  <span className="material-link__usage-label">{percent}% aplicado</span>
                  <div className="material-link__stepper">
                    <button type="button" onClick={() => ajustar(item, -1)} disabled={marcado <= 0} aria-label={`Diminuir ${item.descricao}`}><Minus className="h-6 w-6" /></button>
                    <label>
                      <span className="sr-only">Quantidade usada de {item.descricao} em {unidade}</span>
                      <input
                        inputMode="decimal"
                        enterKeyHint="done"
                        value={valor}
                        placeholder="0"
                        onChange={event => digitar(item, event.target.value)}
                        onFocus={event => event.target.select()}
                      />
                      <small>{unidade}</small>
                    </label>
                    <button type="button" onClick={() => ajustar(item, 1)} aria-label={`Aumentar ${item.descricao}`}><Plus className="h-6 w-6" /></button>
                  </div>
                  {excede && <p className="material-link__warning" role="status"><AlertTriangle className="h-4 w-4" /> Passa do que sobrou neste ramo. Pode salvar: o escritório confere.</p>}
                </article>
              );
            })}
          </section>

          {lancadosNoRamo.length > 0 && (
            <section className="material-link__today" data-material-reveal>
              <h2>Já lançado hoje neste ramo</h2>
              <ul>
                {lancadosNoRamo.slice(0, 12).map(uso => {
                  const material = ramo.materiais.find(item => item.materialId === uso.materialId);
                  const hora = uso.criadoEm ? new Date(uso.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <li key={uso.id}>
                      <strong>{material ? `${number(inCountUnit(material, uso.quantidade))} ${countUnit(material)}` : number(uso.quantidade)}</strong>
                      <span>{material?.descricao || 'Material'}</span>
                      <small>{[uso.apontador, hora].filter(Boolean).join(' às ')}</small>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {erroEnvio && <div role="alert" className="presence-public__error"><AlertTriangle className="h-5 w-5" /> {erroEnvio}</div>}

          <div className="presence-public__submit-bar">
            <div className="presence-public__pending-count">
              <Clock3 className="h-5 w-5" />
              <strong>{itensMarcados.length === 0 ? 'Nada marcado' : unidadesMarcadas.size === 1 ? `${number(totalMarcado)} ${[...unidadesMarcadas][0]}` : `${itensMarcados.length} materiais`}</strong>
              <span>{dayLabel(data || hoje, hoje)} · {ramo.nome}</span>
            </div>
            <div className="presence-public__submit-actions">
              <button type="submit" className="material-link__primary" disabled={enviando || itensMarcados.length === 0}>
                {enviando ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                {enviando ? 'Salvando' : 'Salvar uso'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
