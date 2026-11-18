import { useRef, useState, type FormEvent } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { reduzMovimento } from '../shared/motion/reduzMovimento';
import { Check, Eye, EyeOff, KeyRound, LogIn } from 'lucide-react';
import { PRODUTO } from '../config/marca';
import { AmbienteCliente, MarcaProduto, SimboloProduto } from '../shared/ui/MarcaProduto';
import { regrasDaSenha } from '../utils/regrasDaSenha';
import { criarMinhaSenha, usePrecisaCriarSenha } from './primeiroAcesso';
import { signInWithCorporateEmail } from './authService';
import { supabaseAuth } from './supabaseAuth';

/* Fotos de obra que servem como fundo da entrada. */
import bgRodovia1600 from '../assets/obra-fotos/rodovia-duplicada-1600.webp';
import bgPonte1600 from '../assets/obra-fotos/ponte-construcao-1600.webp';
import bgSerra1600 from '../assets/obra-fotos/rodovia-serra-1600.webp';

const BG_IMAGES = [bgRodovia1600, bgPonte1600, bgSerra1600];

interface LoginScreenProps {
  username: string;
  password: string;
  showPassword: boolean;
  isAuthenticating: boolean;
  loginError: string;
  loginNotice: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePasswordVisibility: () => void;
  onSubmit: (event: FormEvent) => void;
  onPasswordRecovery: () => void;
}

export function AuthLoadingScreen() {
  return (
    <div className="login-redesign flex items-center justify-center p-4 text-slate-700">
      <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 px-5 py-4 text-sm font-semibold shadow-xl">
        <span className="w-5 h-5 border-2 border-slate-300 border-t-emerald-700 rounded-full animate-spin" />
        Validando acesso seguro
      </div>
    </div>
  );
}

export function LoginScreen({
  username, password, showPassword, isAuthenticating,
  loginError, loginNotice, onUsernameChange, onPasswordChange,
  onTogglePasswordVisibility, onSubmit, onPasswordRecovery,
}: LoginScreenProps) {
  const viewportRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const [bgIndex] = useState(() => Math.floor(Math.random() * BG_IMAGES.length));
  // Primeiro acesso: login sem senha da pessoa troca o campo de senha por "Crie sua senha".
  const criarSenha = usePrecisaCriarSenha(username);
  const [repetida, setRepetida] = useState('');
  const [erroCriar, setErroCriar] = useState('');
  const [salvando, setSalvando] = useState(false);
  const regras = regrasDaSenha(password, repetida);

  const salvarSenha = async (event: FormEvent) => {
    event.preventDefault();
    if (salvando) return;
    const falta = regras.find(regra => !regra.ok);
    if (falta) { setErroCriar(falta.falta); return; }
    setErroCriar('');
    setSalvando(true);
    try {
      await criarMinhaSenha(username, password, repetida);
      // O resto (abrir o sistema) cada tela faz pelo aviso de login (onAuthStateChanged).
      await signInWithCorporateEmail(supabaseAuth, username, password);
    } catch (falha) {
      setErroCriar(falha instanceof Error ? falha.message : 'Não foi possível criar a senha. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  useGSAP(() => {
    if (reduzMovimento()) return;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    const brandItems = brandRef.current?.querySelectorAll('[data-login-reveal]');
    if (brandItems?.length) {
      tl.fromTo(brandItems, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1 }, 0);
    }
    if (cardRef.current) {
      tl.fromTo(cardRef.current, { opacity: 0, y: 18, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.8 }, 0.15);
    }
    const cardItems = cardRef.current?.querySelectorAll('[data-card-reveal]');
    if (cardItems?.length) {
      tl.fromTo(cardItems, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06 }, 0.35);
    }
  }, { scope: viewportRef });

  useGSAP(() => {
    if (reduzMovimento() || !alertsRef.current || (!loginError && !loginNotice)) return;
    gsap.fromTo(alertsRef.current, { opacity: 0, y: -8, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.35 });
  }, { dependencies: [loginError, loginNotice] });

  return (
    <main ref={viewportRef} className="login-redesign" id="login-viewport">
      <div className="login-bg" aria-hidden="true">
        <img className="login-bg__img" src={BG_IMAGES[bgIndex]} alt="" />
        <div className="login-bg__overlay" />
      </div>
      <div className="login-grid">
        <div ref={brandRef} className="login-brand">
          <div data-login-reveal>
            <MarcaProduto claro />
          </div>
          <div data-login-reveal className="max-w-lg">
            <h1 className="max-w-[16ch] text-[clamp(2.25rem,4.5vw,3.5rem)] font-black leading-[1] tracking-[-0.04em] text-white">
              {PRODUTO.descricao}.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/70">
              Frota, combustível, equipes e diário de obra num lugar só.
            </p>
          </div>
        </div>
        <div className="login-form-side">
          <div ref={cardRef} className="login-card">
            <div data-card-reveal className="mb-6 flex items-center gap-2.5">
              <SimboloProduto className="size-9" />
              <span className="text-lg font-black tracking-[-0.02em] text-slate-900">{PRODUTO.nome}</span>
            </div>
            <div data-card-reveal>
              <h2 className="text-[1.625rem] font-extrabold tracking-[-0.03em] text-slate-900 leading-tight">{criarSenha ? 'Crie sua senha' : 'Entrar'}</h2>
              <p className="mt-2 inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <AmbienteCliente />
              </p>
            </div>
            <form onSubmit={criarSenha ? event => void salvarSenha(event) : onSubmit} className="mt-6 space-y-4" noValidate={criarSenha}>
              <div data-card-reveal className="space-y-1.5">
                <label htmlFor="login-email" className="text-sm font-bold text-slate-700">E-mail</label>
              <input id="login-email" name="email" type="email" autoComplete="email" placeholder="nome@empresa.com.br" value={username} onChange={event => onUsernameChange(event.target.value)} className="login-input renea-control" required />
              </div>
              {criarSenha ? (
                <div className="space-y-4" data-testid="criar-senha">
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm font-semibold text-emerald-900">Primeiro acesso: crie a sua senha. Só você vai saber.</p>
                  <div className="space-y-1.5">
                    <label htmlFor="login-password" className="text-sm font-bold text-slate-700">Digite sua senha</label>
                    <div className="relative">
                      <input id="login-password" name="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={event => { onPasswordChange(event.target.value); setErroCriar(''); }} className="login-input renea-control pr-12" data-testid="criar-senha-1" />
                      <button type="button" onClick={onTogglePasswordVisibility} title={showPassword ? 'Esconder senha' : 'Mostrar senha'} aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors duration-200">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="login-password-2" className="text-sm font-bold text-slate-700">Digite novamente</label>
                    <input id="login-password-2" name="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={repetida} onChange={event => { setRepetida(event.target.value); setErroCriar(''); }} className="login-input renea-control" data-testid="criar-senha-2" />
                  </div>
                  <ul className="grid gap-1 text-sm" aria-label="O que a senha precisa ter">
                    {regras.map(regra => (
                      <li key={regra.texto} className={`flex items-center gap-2 ${regra.ok ? 'font-semibold text-emerald-800' : 'text-slate-600'}`}>
                        <span className={`grid size-5 place-items-center rounded-full border ${regra.ok ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`} aria-hidden="true">
                          {regra.ok ? <Check className="size-3.5" /> : null}
                        </span>
                        {regra.texto}<span className="sr-only">{regra.ok ? ': ok' : ': falta'}</span>
                      </li>
                    ))}
                  </ul>
                  {erroCriar && <div role="alert" className="text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-3">{erroCriar}</div>}
                  <button type="submit" disabled={salvando} className="login-submit renea-button-primary" data-testid="criar-senha-salvar"><KeyRound className="w-4 h-4" />{salvando ? 'Salvando…' : 'Confirmar e entrar'}</button>
                </div>
              ) : (
                <>
                <div data-card-reveal className="space-y-1.5">
                  <label htmlFor="login-password" className="text-sm font-bold text-slate-700">Senha</label>
                  <div className="relative">
                    <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Sua senha" value={password} onChange={event => onPasswordChange(event.target.value)} className="login-input renea-control pr-12" required />
                    <button type="button" onClick={onTogglePasswordVisibility} title={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors duration-200">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {(loginError || loginNotice) && (
                  <div ref={alertsRef}>
                    {loginError && (<div role="alert" className="text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-3">{loginError}</div>)}
                    {loginNotice && (<div role="status" className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-3">{loginNotice}</div>)}
                  </div>
                )}
                <button data-card-reveal type="submit" disabled={isAuthenticating} className="login-submit renea-button-primary"><LogIn className="w-4 h-4" />Entrar</button>
                <button data-card-reveal type="button" onClick={onPasswordRecovery} className="w-full rounded-lg py-2 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900 transition-colors duration-200">Recuperar senha</button>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
