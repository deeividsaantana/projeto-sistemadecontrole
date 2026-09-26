import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { filtrarOpcoes, type OpcaoNomeada } from '../../modules/materials/lancamentoRapido';
import { CAMPO, FOCO } from '../cadastros/estilos';

interface Props {
  opcoes: readonly OpcaoNomeada[];
  valor: string;
  onEscolher: (id: string) => void;
  /** Ids que aparecem primeiro, antes de a pessoa digitar. */
  recentes?: readonly string[];
  placeholder?: string;
  /** Texto da opção que deixa o campo em branco. Sem ele, não há opção vazia. */
  vazio?: string;
  rotuloAcessivel?: string;
  compacto?: boolean;
  id?: string;
  testId?: string;
  onEnter?: () => void;
}

/**
 * Campo de escolha com busca: digita parte do nome ou do código e escolhe com
 * Enter ou com o dedo. Substitui a lista suspensa de centenas de materiais,
 * onde achar o item certo era rolar até cansar.
 */
export default function CampoEscolha({ opcoes, valor, onEscolher, recentes = [], placeholder = 'Digite para buscar', vazio, rotuloAcessivel, compacto = false, id, testId, onEnter }: Props) {
  const escolhida = opcoes.find(opcao => opcao.id === valor);
  const [texto, setTexto] = useState(escolhida?.nome ?? '');
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const [digitou, setDigitou] = useState(false);
  const listaId = useId();
  const campoRef = useRef<HTMLInputElement>(null);

  // Quando o valor muda por fora (linha repetida, formulário limpo), o texto acompanha.
  useEffect(() => {
    if (document.activeElement !== campoRef.current) setTexto(escolhida?.nome ?? '');
  }, [escolhida?.nome]);

  const sugestoes = useMemo(() => {
    if (digitou && texto.trim()) return filtrarOpcoes(opcoes, texto);
    const primeiro = recentes.map(idRecente => opcoes.find(opcao => opcao.id === idRecente)).filter((opcao): opcao is OpcaoNomeada => Boolean(opcao));
    const resto = opcoes.filter(opcao => !recentes.includes(opcao.id));
    return [...primeiro, ...resto].slice(0, 8);
  }, [digitou, opcoes, recentes, texto]);
  const itens: Array<OpcaoNomeada | null> = vazio ? [null, ...sugestoes] : sugestoes;

  const escolher = (opcao: OpcaoNomeada | null) => {
    onEscolher(opcao?.id ?? '');
    setTexto(opcao?.nome ?? '');
    setDigitou(false);
    setAberto(false);
  };

  const teclar = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!aberto) { setAberto(true); setDestaque(vazio ? 1 : 0); return; }
      const passo = event.key === 'ArrowDown' ? 1 : -1;
      setDestaque(atual => Math.max(0, Math.min(itens.length - 1, atual + passo)));
      return;
    }
    if (event.key === 'Enter') {
      // O Enter é do campo: escolhe a opção e não salva o formulário por baixo.
      event.stopPropagation();
      event.preventDefault();
      if (aberto && itens.length) escolher(itens[Math.min(destaque, itens.length - 1)]);
      onEnter?.();
      return;
    }
    if (event.key === 'Escape' && aberto) {
      event.stopPropagation();
      event.preventDefault();
      setAberto(false);
      setTexto(escolhida?.nome ?? '');
      setDigitou(false);
    }
  };

  const altura = compacto ? 'min-h-10 text-sm' : '';
  const indiceDestaque = Math.min(destaque, itens.length - 1);

  return (
    <div className="relative">
      <input
        ref={campoRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-label={rotuloAcessivel}
        aria-activedescendant={aberto && itens.length ? `${listaId}-${indiceDestaque}` : undefined}
        autoComplete="off"
        data-testid={testId}
        value={texto}
        placeholder={placeholder}
        onFocus={event => { event.currentTarget.select(); setAberto(true); setDestaque(0); }}
        onChange={event => { setTexto(event.target.value); setDigitou(true); setAberto(true); setDestaque(vazio && !event.target.value ? 0 : vazio ? 1 : 0); }}
        onBlur={() => {
          // Sai do campo sem escolher: volta ao que estava, nada fica pela metade.
          setAberto(false);
          setTexto(escolhida?.nome ?? '');
          setDigitou(false);
        }}
        onKeyDown={teclar}
        className={`${CAMPO} ${altura} pr-9`}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      {aberto && (
        <ul
          id={listaId}
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-72 min-w-[14rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {itens.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">Nada com esse nome no cadastro.</li>}
          {itens.map((opcao, indice) => {
            const ativa = indice === indiceDestaque;
            const marcada = (opcao?.id ?? '') === valor;
            return (
              <li
                key={opcao?.id ?? 'vazio'}
                id={`${listaId}-${indice}`}
                role="option"
                aria-selected={ativa}
                // mousedown para escolher antes do blur fechar a lista.
                onMouseDown={event => { event.preventDefault(); escolher(opcao); }}
                onMouseEnter={() => setDestaque(indice)}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm ${ativa ? 'bg-emerald-50 text-[#176b4d]' : 'text-slate-700'} ${FOCO}`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${opcao ? 'font-semibold' : 'italic text-slate-500'}`}>{opcao?.nome ?? vazio}</span>
                  {opcao?.apelido && <span className="block truncate text-xs text-slate-500">{opcao.apelido}</span>}
                </span>
                {!digitou && opcao && recentes.includes(opcao.id) && <span className="shrink-0 text-xs text-slate-400">recente</span>}
                {marcada && <Check className="size-4 shrink-0 text-[#176b4d]" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
