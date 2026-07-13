import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, PenLine } from 'lucide-react';

interface SignaturePadProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function SignaturePad({ value = '', onChange, disabled = false }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(Boolean(value));

  const prepareCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#0f172a';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, rect.width, rect.height);

    if (value) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height);
      image.src = value;
    }
  };

  useEffect(() => {
    prepareCanvas();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(prepareCanvas);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [value]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const point = pointFromEvent(event);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const point = pointFromEvent(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasInk(true);
  };

  const finishDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = event.currentTarget;
    canvas.getContext('2d')?.closePath();
    onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    onChange('');
    setHasInk(false);
    requestAnimationFrame(prepareCanvas);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-black uppercase text-slate-600">
          <PenLine className="h-4 w-4 text-emerald-600" /> Assinatura digital
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasInk}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-600 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Limpar
        </button>
      </div>
      <div className="relative overflow-hidden rounded-md border-2 border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
          className="block h-48 w-full touch-none cursor-crosshair"
          aria-label="Área para assinatura digital"
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-xs font-medium text-slate-400">
            Assine com o dedo ou com o mouse
          </span>
        )}
      </div>
    </div>
  );
}
