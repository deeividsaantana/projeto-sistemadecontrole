import type { FormEvent } from 'react';
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
      <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/80 px-5 py-4 text-sm font-semibold shadow-xl backdrop-blur-xl">
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
  return (
    <main className="login-shell flex items-center justify-center p-4 text-slate-900 antialiased font-sans" id="login-viewport">
      <div className="login-frame">
        <section className="login-story" aria-label="Operação RENEA">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgb(52_211_153_/_0.16)]" />
            Operação conectada
          </div>
          <div className="max-w-lg">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">RENEA Infraestrutura</p>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.035em] text-white md:text-5xl">
              Decisões de campo com informação confiável.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/75">
              Frota, equipes, combustível e produção reunidos em um ambiente operacional seguro.
            </p>
          </div>
          <p className="text-[11px] text-white/55">Ambiente corporativo · acesso monitorado</p>
        </section>

        <section className="login-panel">
        <div className="mb-8">
          <div className="w-44 h-auto flex items-center mb-6">
            <img
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
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="text-xs font-semibold text-slate-700">E-mail corporativo</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nome@empresa.com.br"
              value={username}
              onChange={event => onUsernameChange(event.target.value)}
              className="h-12 w-full bg-white border border-slate-300 rounded-xl px-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all"
              required
            />
          </div>

          <div className="space-y-1.5">
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
                className="h-12 w-full bg-white border border-slate-300 rounded-xl px-4 pr-12 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                required
              />
              <button
                type="button"
                onClick={onTogglePasswordVisibility}
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

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

          <button
            type="submit"
            disabled={isAuthenticating}
            className="group mt-1 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-semibold text-white shadow-lg transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-emerald-800 active:scale-[0.985] disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            Entrar no sistema
          </button>
          <button type="button" onClick={onPasswordRecovery} className="w-full rounded-lg py-2 text-center text-xs font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900">
            Recuperar senha
          </button>
        </form>

        <div className="mt-7 pt-5 border-t border-slate-200 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          Acesso restrito a contas autorizadas
        </div>
        </section>
      </div>
    </main>
  );
}
