import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Eraser, PenLine, Type } from 'lucide-react';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, FOCO } from '../cadastros/estilos';
import type { AssinaturaEnviada } from '../../services/contratacaoApi';

interface QuadroAssinaturaProps {
  /** Nome do login: a assinatura digitada é sempre o nome de quem entrou. */
  nome: string;
  rotuloConfirmar: string;
  ocupado?: boolean;
  onConfirmar: (assinatura: AssinaturaEnviada) => void;
  onCancelar?: () => void;
}

/**
 * Desenhar com o dedo, o mouse ou a caneta, ou usar o nome digitado. O nome
 * não é editável: vem do login, para ninguém assinar com o nome de outro.
 */
export function QuadroAssinatura({ nome, rotuloConfirmar, ocupado = false, onConfirmar, onCancelar }: QuadroAssinaturaProps) {
  const [modo, setModo] = useState<'desenho' | 'digitado'>('desenho');
  const [temTraco, setTemTraco] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || modo !== 'desenho') return;
    const ajustar = () => {
      const largura = canvas.clientWidth;
      const altura = canvas.clientHeight;
      canvas.width = largura * 2;
      canvas.height = altura * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(2, 2);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
      setTemTraco(false);
    };
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, [modo]);

  const ponto = (evento: PointerEvent<HTMLCanvasElement>) => {
    const caixa = evento.currentTarget.getBoundingClientRect();
    return { x: evento.clientX - caixa.left, y: evento.clientY - caixa.top };
  };
  const comecar = (evento: PointerEvent<HTMLCanvasElement>) => {
    const ctx = evento.currentTarget.getContext('2d');
    if (!ctx) return;
    evento.currentTarget.setPointerCapture(evento.pointerId);
    desenhando.current = true;
    const { x, y } = ponto(evento);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    setTemTraco(true);
  };
  const mover = (evento: PointerEvent<HTMLCanvasElement>) => {
    if (!desenhando.current) return;
    const ctx = evento.currentTarget.getContext('2d');
    if (!ctx) return;
    const { x, y } = ponto(evento);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const parar = () => { desenhando.current = false; };
  const limpar = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setTemTraco(false);
  };

  const confirmar = () => {
    if (modo === 'digitado') { onConfirmar({ method: 'digitado' }); return; }
    const canvas = canvasRef.current;
    if (!canvas || !temTraco) return;
    // Reduz para no máximo 600 px de largura: a assinatura fica leve.
    const escala = Math.min(1, 600 / canvas.width);
    const copia = document.createElement('canvas');
    copia.width = Math.round(canvas.width * escala);
    copia.height = Math.round(canvas.height * escala);
    copia.getContext('2d')?.drawImage(canvas, 0, 0, copia.width, copia.height);
    onConfirmar({ method: 'desenho', image_data: copia.toDataURL('image/png') });
  };

  const abaModo = (ativo: boolean) => `${FOCO} inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition ${ativo ? 'bg-[#176b4d] text-white' : 'text-slate-700 hover:text-[#176b4d]'}`;

  return (
    <div className="space-y-3" data-testid="quadro-assinatura">
      <div role="radiogroup" aria-label="Como assinar" className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1">
        <button type="button" role="radio" aria-checked={modo === 'desenho'} onClick={() => setModo('desenho')} className={abaModo(modo === 'desenho')}>
          <PenLine className="size-4" aria-hidden="true" /> Desenhar
        </button>
        <button type="button" role="radio" aria-checked={modo === 'digitado'} onClick={() => setModo('digitado')} className={abaModo(modo === 'digitado')}>
          <Type className="size-4" aria-hidden="true" /> Usar meu nome
        </button>
      </div>
      {modo === 'desenho' ? (
        <div>
          <canvas
            ref={canvasRef}
            aria-label="Quadro para desenhar a assinatura"
            className="block h-40 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-white"
            onPointerDown={comecar}
            onPointerMove={mover}
            onPointerUp={parar}
            onPointerCancel={parar}
            onPointerLeave={parar}
          />
          <p className="mt-1.5 text-xs text-[#5b6870]">Assine com o dedo, o mouse ou a caneta dentro do quadro.</p>
        </div>
      ) : (
        <div className="grid h-40 place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-4">
          <span className="truncate font-serif text-3xl italic text-slate-900">{nome}</span>
        </div>
      )}
      <p className="text-xs text-[#5b6870]">Ao confirmar, sua assinatura fica registrada com seu login, a data e a hora. Depois disso, ela não pode ser trocada.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={confirmar} disabled={ocupado || (modo === 'desenho' && !temTraco)} className={BOTAO_PRIMARIO} data-testid="confirmar-assinatura">
          {ocupado ? 'Enviando…' : rotuloConfirmar}
        </button>
        {modo === 'desenho' && (
          <button type="button" onClick={limpar} disabled={ocupado || !temTraco} className={BOTAO_SECUNDARIO}>
            <Eraser className="size-4" aria-hidden="true" /> Limpar
          </button>
        )}
        {onCancelar && <button type="button" onClick={onCancelar} disabled={ocupado} className={BOTAO_SECUNDARIO}>Voltar</button>}
      </div>
    </div>
  );
}
