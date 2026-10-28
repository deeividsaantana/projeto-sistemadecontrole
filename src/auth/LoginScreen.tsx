import { useRef, useState, type FormEvent } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { reduzMovimento } from '../shared/motion/reduzMovimento';
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';

/* Fotos editoriais RENEA — servem como background full-bleed. */
import bgRodovia1600 from '../assets/renea-editorial/rodovia-duplicada-1600.webp';
import bgPonte1600 from '../assets/renea-editorial/ponte-construcao-1600.webp';
import bgSerra1600 from '../assets/renea-editorial/rodovia-serra-1600.webp';

const BG_IMAGES = [bgRodovia1600, bgPonte1600, bgSerra1600];

interface LoginScreenProps {
  logoSrc: string;
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
  logoSrc, username, password, showPassword, isAuthenticating,
  loginError, loginNotice, onUsernameChange, onPasswordChange,
  onTogglePasswordVisibility, onSubmit, onPasswordRecovery,
}: LoginScreenProps) {
  const viewportRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const [bgIndex] = useState(() => Math.floor(Math.random() * BG_IMAGES.length));

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
          <div data-login-reveal className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white/70">
            <span className="login-pulse-dot" />
            Operação conectada
          </div>
          <div data-login-reveal className="max-w-lg">
            <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white/60">RENEA Infraestrutura</p>
            <h1 className="max-w-[16ch] text-[clamp(2.5rem,5vw,4rem)] font-black leading-[0.95] tracking-[-0.04em] text-white">
              Conectando obras ao{' '}
              <span className="text-emerald-300">futuro da infraestrutura.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/55">
              Frota, equipes, combustível e produção reunidos em um ambiente operacional seguro.
            </p>
          </div>
          <div data-login-reveal className="login-brand-stats">
            <div><div className="text-2xl font-extrabold text-white tracking-tight">142</div><div className="text-[0.6rem] font-semibold uppercase tracking-wider text-white/40 mt-0.5">Equipamentos</div></div>
            <div><div className="text-2xl font-extrabold text-white tracking-tight">38</div><div className="text-[0.6rem] font-semibold uppercase tracking-wider text-white/40 mt-0.5">Equipes ativas</div></div>
            <div><div className="text-2xl font-extrabold text-white tracking-tight">99.7%</div><div className="text-[0.6rem] font-semibold uppercase tracking-wider text-white/40 mt-0.5">Uptime</div></div>
          </div>
        </div>
        <div className="login-form-side">
          <div ref={cardRef} className="login-card">
            <div data-card-reveal className="w-44 mb-6">
              <img src={logoSrc} alt="RENEA Infraestrutura" className="w-full h-auto object-contain" referrerPolicy="no-referrer" />
            </div>
            <div data-card-reveal>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-emerald-700">Sistema integrado</p>
              <h2 className="mt-1.5 text-[1.625rem] font-extrabold tracking-[-0.03em] text-slate-900 leading-tight">Acesse sua operação</h2>
              <p className="mt-1.5 text-[0.8rem] leading-relaxed text-slate-500">Entre com as credenciais autorizadas pela administração.</p>
            </div>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div data-card-reveal className="space-y-1.5">
                <label htmlFor="login-email" className="text-[0.7rem] font-bold text-slate-700">E-mail corporativo</label>
                <input id="login-email" name="email" type="email" autoComplete="email" placeholder="nome@renea.com.br" value={username} onChange={event => onUsernameChange(event.target.value)} className="login-input" required />
              </div>
              <div data-card-reveal className="space-y-1.5">
                <label htmlFor="login-password" className="text-[0.7rem] font-bold text-slate-700">Senha de acesso</label>
                <div className="relative">
                  <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Senha corporativa" value={password} onChange={event => onPasswordChange(event.target.value)} className="login-input pr-12" required />
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
              <button data-card-reveal type="submit" disabled={isAuthenticating} className="login-submit"><LogIn className="w-4 h-4" />Entrar no sistema</button>
              <button data-card-reveal type="button" onClick={onPasswordRecovery} className="w-full rounded-lg py-2 text-center text-xs font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900 transition-colors duration-200">Recuperar senha</button>
            </form>
            <div data-card-reveal className="mt-6 pt-4 border-t border-slate-200/60 text-center text-[0.65rem] font-semibold text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              Acesso restrito a contas autorizadas
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
