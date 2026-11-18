import { useEffect, useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, KeyRound } from 'lucide-react';
import { PRODUTO } from './config/marca';
import { MarcaProduto, SimboloProduto } from './shared/ui/MarcaProduto';
import { supabaseAuth } from './auth/supabaseAuth';
import { signInWithCorporateEmail } from './auth/authService';
import { getPrimeiroAcessoTokenFromUrl } from './app/routing/publicRoutes';
import { regrasDaSenha } from './utils/regrasDaSenha';
import bgRodovia1600 from './assets/obra-fotos/rodovia-duplicada-1600.webp';

type Estado =
  | { fase: 'carregando' }
  | { fase: 'vencido'; mensagem: string }
  | { fase: 'criar'; nome: string; email: string }
  | { fase: 'pronto'; email: string };

const LINK_VENCIDO = 'Este link já foi usado ou venceu. Peça um link novo para quem criou o seu login.';

const chamar = async <T,>(corpo: Record<string, unknown>): Promise<{ ok: boolean; status: number; data?: T; message?: string }> => {
  const resposta = await fetch('/api/primeiro-acesso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(corpo),
    cache: 'no-store',
  });
  const json = await resposta.json().catch(() => ({})) as { success?: boolean; data?: T; message?: string };
  return { ok: resposta.ok && json.success === true, status: resposta.status, data: json.data, message: json.message };
};

/**
 * Primeiro acesso: a pessoa abre o link que recebeu, cria a própria senha
 * (digita duas vezes) e já entra. Quem criou o login nunca vê essa senha.
 * Tela leve, fora do ERP, no mesmo visual da tela de entrada.
 */
export default function PrimeiroAcessoApp() {
  const [token] = useState(getPrimeiroAcessoTokenFromUrl);
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const [senha, setSenha] = useState('');
  const [repetida, setRepetida] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    document.title = `Criar senha · ${PRODUTO.nome}`;
    if (!token) { setEstado({ fase: 'vencido', mensagem: LINK_VENCIDO }); return; }
    chamar<{ nome: string; email: string }>({ action: 'ver', token })
      .then(resposta => {
        if (resposta.ok && resposta.data) setEstado({ fase: 'criar', nome: resposta.data.nome, email: resposta.data.email });
        else setEstado({ fase: 'vencido', mensagem: resposta.message || LINK_VENCIDO });
      })
      .catch(() => setEstado({ fase: 'vencido', mensagem: 'Sem conexão com o servidor. Confira a internet e abra o link de novo.' }));
  }, [token]);

  const regras = regrasDaSenha(senha, repetida);

  const salvar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (estado.fase !== 'criar' || salvando) return;
    const falta = regras.find(regra => !regra.ok);
    if (falta) { setErro(falta.falta); return; }
    setErro('');
    setSalvando(true);
    try {
      const resposta = await chamar<{ email: string }>({ action: 'criar', token, senha, repetida });
      if (!resposta.ok) {
        if (resposta.status === 410 || resposta.status === 403) setEstado({ fase: 'vencido', mensagem: resposta.message || LINK_VENCIDO });
        else setErro(resposta.message || 'Não foi possível salvar. Tente de novo.');
        return;
      }
      // O código do link já não vale: tira do endereço antes de seguir.
      window.history.replaceState(null, '', '/');
      try {
        await signInWithCorporateEmail(supabaseAuth, estado.email, senha);
        window.location.replace('/');
      } catch {
        setEstado({ fase: 'pronto', email: estado.email });
      }
    } catch {
      setErro('Sem conexão com o servidor. Confira a internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const campo = 'login-input renea-control pr-12';

  const corpo = () => {
    if (estado.fase === 'carregando') {
      return <p className="flex items-center gap-3 text-sm font-semibold text-slate-700"><span className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-700" />Abrindo o seu link…</p>;
    }
    if (estado.fase === 'vencido') {
      return (
        <div className="grid gap-4" data-testid="primeiro-acesso-vencido">
          <h2 className="text-[1.625rem] font-extrabold leading-tight tracking-[-0.03em] text-slate-900">Link sem validade</h2>
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm font-semibold text-amber-900">{estado.mensagem}</p>
          <a href="/" className="text-center text-sm font-semibold text-emerald-700 underline">Já tenho senha, quero entrar</a>
        </div>
      );
    }
    if (estado.fase === 'pronto') {
      return (
        <div className="grid gap-4" data-testid="primeiro-acesso-pronto">
          <h2 className="text-[1.625rem] font-extrabold leading-tight tracking-[-0.03em] text-slate-900">Senha criada</h2>
          <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm font-semibold text-emerald-900">Pronto. Agora entre com <strong>{estado.email}</strong> e a senha que você acabou de criar.</p>
          <a href="/" className="login-submit renea-button-primary">Ir para a entrada</a>
        </div>
      );
    }
    return (
      <form onSubmit={evento => void salvar(evento)} className="grid gap-4" noValidate data-testid="primeiro-acesso-form">
        <div>
          <h2 className="text-[1.625rem] font-extrabold leading-tight tracking-[-0.03em] text-slate-900">Crie sua senha</h2>
          <p className="mt-2 text-sm text-slate-700">
            {estado.nome ? <>Olá, <strong>{estado.nome.split(' ')[0]}</strong>. </> : null}
            Só você vai saber esta senha.
          </p>
          <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Seu login: <strong className="[overflow-wrap:anywhere]">{estado.email}</strong>
          </p>
        </div>
        {/* Ajuda o gerenciador de senhas do celular a guardar o par e-mail + senha. */}
        <input type="email" name="email" autoComplete="username" value={estado.email} readOnly hidden />
        <div className="grid gap-1.5">
          <label htmlFor="senha-nova" className="text-sm font-bold text-slate-700">Digite sua senha</label>
          <div className="relative">
            <input id="senha-nova" name="new-password" type={mostrar ? 'text' : 'password'} autoComplete="new-password" value={senha} onChange={evento => { setSenha(evento.target.value); setErro(''); }} className={campo} autoFocus data-testid="primeiro-acesso-senha" />
            <button type="button" onClick={() => setMostrar(atual => !atual)} aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'} title={mostrar ? 'Esconder senha' : 'Mostrar senha'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              {mostrar ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="senha-repetida" className="text-sm font-bold text-slate-700">Digite novamente</label>
          <input id="senha-repetida" name="confirm-password" type={mostrar ? 'text' : 'password'} autoComplete="new-password" value={repetida} onChange={evento => { setRepetida(evento.target.value); setErro(''); }} className={campo} data-testid="primeiro-acesso-repetida" />
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
        {erro && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-semibold text-rose-800">{erro}</p>}
        <button type="submit" disabled={salvando} className="login-submit renea-button-primary" data-testid="primeiro-acesso-salvar">
          <KeyRound className="size-4" aria-hidden="true" />{salvando ? 'Salvando…' : 'Confirmar e entrar'}
        </button>
      </form>
    );
  };

  return (
    <main className="login-redesign" id="login-viewport">
      <div className="login-bg" aria-hidden="true">
        <img className="login-bg__img" src={bgRodovia1600} alt="" />
        <div className="login-bg__overlay" />
      </div>
      <div className="login-grid">
        <div className="login-brand">
          <MarcaProduto claro />
          <div className="max-w-lg">
            <h1 className="max-w-[16ch] text-[clamp(2.25rem,4.5vw,3.5rem)] font-black leading-[1] tracking-[-0.04em] text-white">Seu primeiro acesso.</h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/70">Crie a sua senha e entre. Ninguém mais fica sabendo dela.</p>
          </div>
        </div>
        <div className="login-form-side">
          <div className="login-card">
            <div className="mb-6 flex items-center gap-2.5">
              <SimboloProduto className="size-9" />
              <span className="text-lg font-black tracking-[-0.02em] text-slate-900">{PRODUTO.nome}</span>
            </div>
            {corpo()}
          </div>
        </div>
      </div>
    </main>
  );
}
