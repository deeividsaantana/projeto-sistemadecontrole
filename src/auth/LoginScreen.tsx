import { useRef, useEffect, type FormEvent } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';

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
    <div className="login-shell flex items-center justify-center p-4 text-slate-700">
      <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/80 px-5 py-4 text-sm font-semibold shadow-xl">
        <span className="w-5 h-5 border-2 border-slate-300 border-t-emerald-700 rounded-full animate-spin" />
        Validando acesso seguro
      </div>
    </div>
  );
}

export function LoginScreen({
  logoSrc,
  username,
  password,
  showPassword,
  isAuthenticating,
  loginError,
  loginNotice,
  onUsernameChange,
  onPasswordChange,
  onTogglePasswordVisibility,
  onSubmit,
  onPasswordRecovery,
}: LoginScreenProps) {
  const storyRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subtextRef = useRef<HTMLParagraphElement>(null);
  const emailFieldRef = useRef<HTMLDivElement>(null);
  const passwordFieldRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const recoveryBtnRef = useRef<HTMLButtonElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });

    timeline
      .fromTo(
        storyRef.current,
        { opacity: 0, x: -40 },
        { opacity: 1, x: 0, duration: 0.8 },
        0
      )
      .fromTo(
        panelRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8 },
        0.1
      )
      .fromTo(
        logoRef.current,
        { opacity: 0, scale: 0.92 },
        { opacity: 1, scale: 1, duration: 0.7 },
        0.2
      )
      .fromTo(
        headingRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.6 },
        0.35
      )
      .fromTo(
        subtextRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.6 },
        0.45
      )
      .fromTo(
        emailFieldRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5 },
        0.55
      )
      .fromTo(
        passwordFieldRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5 },
        0.65
      )
      .fromTo(
        submitBtnRef.current,
        { opacity: 0, scale: 0.96 },
        { opacity: 1, scale: 1, duration: 0.5 },
        0.75
      )
      .fromTo(
        recoveryBtnRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4 },
        0.85
      )
      .fromTo(
        footerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.4 },
        0.95
      );

    if (alertsRef.current && (loginError || loginNotice)) {
      gsap.fromTo(
        alertsRef.current,
        { opacity: 0, y: -10, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4 }
      );
    }
  }, { scope: panelRef });

  return (
    <main className="login-shell flex items-center justify-center p-4 text-slate-900 antialiased font-sans" id="login-viewport">
      <div className="login-frame">
        <section
          ref={storyRef}
          className="login-story"
          aria-label="Operação RENEA"
        >
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgb(52_211_153_/_0.16)]" />
            Operação conectada
          </div>
          <div className="max-w-lg">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">RENEA Infraestrutura</p>
            <h1
              ref={headingRef}
              className="max-w-xl text-4xl font-black leading-[.98] tracking-[-0.055em] text-slate-950 md:text-6xl"
            >
              Decisões de campo com informação confiável.
            </h1>
            <p
              ref={subtextRef}
              className="mt-5 max-w-md text-sm leading-6 text-slate-600"
            >
              Frota, equipes, combustível e produção reunidos em um ambiente operacional seguro.
            </p>
          </div>
          <p className="text-[11px] font-semibold text-slate-500">Ambiente corporativo · acesso monitorado</p>
        </section>

        <section
          ref={panelRef}
          className="login-panel"
        >
          <div className="mb-8">
            <div className="w-44 h-auto flex items-center mb-6">
              <img
                ref={logoRef}
                src={logoSrc}
                alt="RENEA Infraestrutura"
                className="w-full h-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Sistema integrado</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-900">Acesse sua operação</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Entre com as credenciais autorizadas pela administração.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4 relative">
            <div
              ref={emailFieldRef}
              className="space-y-1.5"
            >
              <label htmlFor="login-email" className="text-xs font-semibold text-slate-700">E-mail corporativo</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nome@empresa.com.br"
                value={username}
                onChange={event => onUsernameChange(event.target.value)}
                className="h-12 w-full bg-white border border-slate-300 rounded-xl px-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all duration-200"
                required
              />
            </div>

            <div
              ref={passwordFieldRef}
              className="space-y-1.5"
            >
              <label htmlFor="login-password" className="text-xs font-semibold text-slate-700">Senha de acesso</label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Senha corporativa"
                  value={password}
                  onChange={event => onPasswordChange(event.target.value)}
                  className="h-12 w-full bg-white border border-slate-300 rounded-xl px-4 pr-12 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={onTogglePasswordVisibility}
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {(loginError || loginNotice) && (
              <div ref={alertsRef}>
                {loginError && (
                  <div role="alert" className="text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-3">
                    {loginError}
                  </div>
                )}

                {loginNotice && (
                  <div role="status" className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-3">
                    {loginNotice}
                  </div>
                )}
              </div>
            )}

            <button
              ref={submitBtnRef}
              type="submit"
              disabled={isAuthenticating}
              className="group mt-1 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-semibold text-white shadow-lg transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-xl active:scale-[0.985] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <LogIn className="w-4 h-4" />
              Entrar no sistema
            </button>
            <button
              ref={recoveryBtnRef}
              type="button"
              onClick={onPasswordRecovery}
              className="w-full rounded-lg py-2 text-center text-xs font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900 transition-colors duration-200"
            >
              Recuperar senha
            </button>
          </form>

          <div
            ref={footerRef}
            className="mt-7 pt-5 border-t border-slate-200 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            Acesso restrito a contas autorizadas
          </div>
        </section>
      </div>
    </main>
  );
}
