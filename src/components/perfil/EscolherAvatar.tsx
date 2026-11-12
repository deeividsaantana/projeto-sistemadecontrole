import { useRef, useState } from 'react';
import { Camera, Check, Trash2 } from 'lucide-react';
import { Avatar, Button } from '../../shared/ui';
import { CORES_AVATAR } from '../../utils/avatar';
import { fotoDePerfil } from '../../utils/imagem';

interface EscolherAvatarProps {
  nome: string;
  foto: string | null;
  cor: string;
  disabled?: boolean;
  onFoto: (foto: string | null) => void;
  onCor: (cor: string) => void;
}

/**
 * Foto e cor da bolinha, lado a lado com a prévia. Um toque em "Trocar foto"
 * abre a galeria (ou a câmera, no celular); a foto já sai cortada e pequena.
 */
export function EscolherAvatar({ nome, foto, cor, disabled = false, onFoto, onCor }: EscolherAvatarProps) {
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState('');
  const [preparando, setPreparando] = useState(false);

  const escolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro('');
    setPreparando(true);
    try {
      onFoto(await fotoDePerfil(arquivo));
    } catch (caught) {
      setErro(caught instanceof Error ? caught.message : 'Não foi possível usar essa foto.');
    } finally {
      setPreparando(false);
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <Avatar nome={nome || '?'} foto={foto} cor={cor} tamanho="xl" />
      <div className="w-full min-w-0 space-y-3">
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <input
            ref={arquivoRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={event => void escolherArquivo(event.target.files?.[0])}
          />
          <Button type="button" variant="secondary" icon={Camera} disabled={disabled || preparando} onClick={() => arquivoRef.current?.click()}>
            {preparando ? 'Preparando…' : foto ? 'Trocar foto' : 'Colocar foto'}
          </Button>
          {foto && (
            <Button type="button" variant="ghost" icon={Trash2} disabled={disabled} onClick={() => onFoto(null)}>
              Tirar foto
            </Button>
          )}
        </div>
        {erro && <p role="alert" className="text-center text-xs font-semibold text-rose-700 sm:text-left">{erro}</p>}
        <fieldset disabled={disabled}>
          <legend className="mb-2 block w-full text-center text-xs font-bold text-slate-500 sm:text-left">
            {foto ? 'Cor (aparece se a foto não carregar)' : 'Cor da bolinha'}
          </legend>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            {CORES_AVATAR.map(opcao => {
              const marcada = opcao.valor === cor;
              return (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => onCor(opcao.valor)}
                  aria-pressed={marcada}
                  aria-label={`Cor ${opcao.nome}`}
                  title={opcao.nome}
                  className={`grid size-10 cursor-pointer place-items-center rounded-full text-white ring-offset-2 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087653] ${marcada ? 'ring-2 ring-slate-900' : 'hover:ring-2 hover:ring-slate-300'}`}
                  style={{ backgroundColor: opcao.valor }}
                >
                  {marcada && <Check className="size-4" strokeWidth={3} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
