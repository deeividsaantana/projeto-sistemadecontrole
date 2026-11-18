/**
 * Login criado: sem link e sem senha. Quando a pessoa entrar com o e-mail,
 * a própria tela de entrada pede para ela criar a senha.
 */
export function AvisoDePrimeiroAcesso({ nome, email }: { nome: string; email: string }) {
  return (
    <p className="text-sm text-slate-700" data-testid="aviso-primeiro-acesso">
      Quando <strong>{nome}</strong> entrar com <strong className="[overflow-wrap:anywhere]">{email}</strong>, o sistema pede para criar a senha. Ninguém mais fica sabendo dela.
    </p>
  );
}
