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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
      <div className="flex items-center gap-3 text-sm font-semibold">
        <span className="w-5 h-5 border-2 border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
        Validando acesso seguro...
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-slate-900 antialiased font-sans" id="login-viewport">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-7 shadow-xl relative overflow-hidden">
        <div className="text-center mb-8 relative">
          <div className="mx-auto w-48 h-auto flex items-center justify-center mb-4">
            <img
              src={logoSrc}
              alt="RENEA Infraestrutura"
              className="w-full h-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">Sistema Integrado de Gestao Operacional</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 relative">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="text-xs font-bold text-slate-700 uppercase">E-mail corporativo</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nome@empresa.com.br"
              value={username}
              onChange={event => onUsernameChange(event.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-colors"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="text-xs font-bold text-slate-700 uppercase">Senha de acesso</label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Senha corporativa"
                value={password}
                onChange={event => onPasswordChange(event.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-4 py-3 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                required
              />
              <button
                type="button"
                onClick={onTogglePasswordVisibility}
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {loginError && (
            <div role="alert" className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-md px-3.5 py-2">
              {loginError}
            </div>
          )}

          {loginNotice && (
            <div role="status" className="text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3.5 py-2">
              {loginNotice}
            </div>
          )}

          <button
            type="submit"
            disabled={isAuthenticating}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-sm uppercase rounded-md shadow-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Entrar no sistema
          </button>
          <button type="button" onClick={onPasswordRecovery} className="w-full text-center text-xs font-bold text-emerald-400 hover:text-emerald-300">
            Recuperar senha
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-200 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Acesso somente para contas autorizadas pela administracao
        </div>
      </div>
    </div>
  );
}
