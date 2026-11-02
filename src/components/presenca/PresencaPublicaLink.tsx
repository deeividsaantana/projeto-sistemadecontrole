import { useState, type FormEvent } from 'react';
import { AlertCircle, LogIn } from 'lucide-react';
import type { Empresa, Funcionario, GrupoEquipe } from '../../types';
import { validarMatricula } from '../../utils/presencaPublicaAuth';
import { BOTAO_PRIMARIO, CAMPO, CARTAO, ROTULO } from '../cadastros/estilos';

interface Props {
  funcionarios: readonly Funcionario[];
  empresas: readonly Empresa[];
  gruposEquipe: readonly GrupoEquipe[];
  onAutenticar: (funcionario: Funcionario) => void;
}

export function PresencaPublicaLink({ funcionarios, onAutenticar }: Props) {
  const [matricula, setMatricula] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const funcionario = validarMatricula(matricula, funcionarios);
    setCarregando(false);
    if (!funcionario) {
      setErro('Matrícula não encontrada. Verifique e tente novamente.');
      return;
    }

    onAutenticar(funcionario);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f6] p-4">
      <section className="w-full max-w-md" aria-labelledby="presenca-publica-titulo">
        <div className={`${CARTAO} p-6 text-center shadow-sm sm:p-8`}>
          <div className="mb-8">
            <h1 id="presenca-publica-titulo" className="mb-2 text-3xl font-black text-slate-950">Presença</h1>
            <p className="text-sm text-slate-600">Digite sua matrícula para acessar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Entrar na presença pela matrícula" noValidate>
            <label className={`${ROTULO} block text-left`}>
              Matrícula
              <input
                type="text"
                autoComplete="off"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                placeholder="Ex: 12345"
                autoFocus
                required
                aria-invalid={erro ? true : undefined}
                aria-describedby={erro ? 'presenca-publica-erro' : undefined}
                className={`${CAMPO} mt-2 text-center text-lg tracking-wider`}
              />
            </label>

            {erro && (
              <div
                id="presenca-publica-erro"
                role="alert"
                className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-left text-sm text-rose-700"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>{erro}</p>
              </div>
            )}

            <button type="submit" disabled={carregando} className={`${BOTAO_PRIMARIO} mt-6 w-full`}>
              <LogIn className="size-4" aria-hidden="true" />
              {carregando ? 'Autenticando...' : 'Acessar'}
            </button>
          </form>

          <p className="mt-6 text-xs text-slate-500">
            Esta é uma aba pública. Não compartilhe seu link pessoal.
          </p>
        </div>
      </section>
    </main>
  );
}
