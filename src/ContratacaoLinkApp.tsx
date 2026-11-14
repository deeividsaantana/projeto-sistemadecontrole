import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { LogOut } from 'lucide-react';
import { supabaseAuth, type SupabaseAuthUser } from './auth/supabaseAuth';
import { AuthLoadingScreen, LoginScreen } from './auth/LoginScreen';
import {
  getLoginErrorMessage,
  normalizeLoginEmail,
  sendPasswordRecoveryEmail,
  signInWithCorporateEmail,
  signOutCurrentUser,
} from './auth/authService';
import { AmbienteCliente, MarcaProduto } from './shared/ui/MarcaProduto';
import { ScreenLoadingFallback } from './shared/components/feedback/ScreenLoadingFallback';

const ContratacaoTab = lazy(() => import('./components/ContratacaoTab'));

/**
 * Link de Solicitação de Contratação, no jeito do link de presença: abre leve,
 * sem carregar o ERP inteiro, e pede o login de cada pessoa. O que cada um vê
 * e assina vem do servidor, pelo login.
 */
export default function ContratacaoLinkApp() {
  const [usuario, setUsuario] = useState<SupabaseAuthUser | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    document.title = 'Solicitação de Contratação';
    return supabaseAuth.onAuthStateChanged(setUsuario);
  }, []);

  const entrar = async (evento: FormEvent) => {
    evento.preventDefault();
    setErro('');
    setAviso('');
    setEntrando(true);
    try { await signInWithCorporateEmail(supabaseAuth, email, senha); }
    catch (falha) { setErro(getLoginErrorMessage(falha)); }
    finally { setEntrando(false); }
  };

  const recuperar = async () => {
    const normalizado = normalizeLoginEmail(email);
    setErro('');
    if (!normalizado) { setErro('Informe seu e-mail para receber a recuperação de senha.'); return; }
    await sendPasswordRecoveryEmail(supabaseAuth, normalizado).catch(() => undefined);
    setAviso('Se a conta estiver autorizada, o e-mail de recuperação foi enviado.');
  };

  if (usuario === undefined) return <AuthLoadingScreen />;
  if (!usuario) {
    return (
      <LoginScreen
        username={email}
        password={senha}
        showPassword={mostrarSenha}
        isAuthenticating={entrando}
        loginError={erro}
        loginNotice={aviso || 'Entre para pedir ou assinar uma contratação.'}
        onUsernameChange={setEmail}
        onPasswordChange={setSenha}
        onTogglePasswordVisibility={() => setMostrarSenha(atual => !atual)}
        onSubmit={evento => void entrar(evento)}
        onPasswordRecovery={() => void recuperar()}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-[#f7f8f6] text-slate-900">
      <header className="sticky top-0 z-20 flex h-[3.25rem] items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:px-4 print:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <MarcaProduto />
          <span className="hidden border-l border-slate-200 pl-3 sm:inline-flex"><AmbienteCliente /></span>
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="hidden truncate text-sm font-semibold text-slate-700 sm:block">{usuario.displayName || usuario.email}</span>
          <button type="button" onClick={() => void signOutCurrentUser(supabaseAuth)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:border-emerald-500 hover:text-[#176b4d]">
            <LogOut className="size-4" aria-hidden="true" /> Sair
          </button>
        </span>
      </header>
      <main id="main-tab-viewport" tabIndex={-1} className="w-full p-[var(--renea-respiro)] print:p-0">
        <Suspense fallback={<ScreenLoadingFallback />}>
          <ContratacaoTab noLink />
        </Suspense>
      </main>
    </div>
  );
}
