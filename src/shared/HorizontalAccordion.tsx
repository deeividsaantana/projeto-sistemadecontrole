import { useRef, useState, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ChevronRight } from 'lucide-react';

interface HorizontalAccordionItemProps {
  id: string;
  trigger: ReactNode;
  content: ReactNode;
  isActive: boolean;
  onToggle: () => void;
  className?: string;
}

function HorizontalAccordionItem({
  id,
  trigger,
  content,
  isActive,
  onToggle,
  className = '',
}: HorizontalAccordionItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!itemRef.current || !contentRef.current) return;

    if (isActive) {
      gsap.to(itemRef.current, {
        flex: '1.5 1 0%',
        duration: 0.5,
        ease: 'power2.out',
      });

      gsap.fromTo(
        contentRef.current,
        { opacity: 0, pointerEvents: 'none' },
        {
          opacity: 1,
          pointerEvents: 'auto',
          duration: 0.4,
          ease: 'power2.out',
          delay: 0.1,
        }
      );
    } else {
      gsap.to(itemRef.current, {
        flex: '0.6 1 0%',
        duration: 0.5,
        ease: 'power2.out',
      });

      gsap.to(contentRef.current, {
        opacity: 0,
        pointerEvents: 'none',
        duration: 0.3,
      });
    }
  }, { dependencies: [isActive] });

  return (
    <div
      ref={itemRef}
      className={`relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm flex flex-shrink-0 ${className}`}
      style={{ flex: isActive ? '1.5 1 0%' : '0.6 1 0%' }}
    >
      <button
        onClick={onToggle}
        aria-expanded={isActive}
        aria-controls={`panel-${id}`}
        className="absolute inset-0 w-full h-full p-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-900 text-sm md:text-base line-clamp-2">
              {trigger}
            </div>
          </div>
          <ChevronRight
            className="w-5 h-5 text-slate-400 shrink-0 transition-transform"
            style={{
              transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </button>

      <div
        ref={contentRef}
        id={`panel-${id}`}
        className="absolute inset-0 w-full h-full p-6 opacity-0 pointer-events-none"
      >
        <div className="mt-8 pr-8 text-sm text-slate-600 overflow-y-auto max-h-full">
          {content}
        </div>
      </div>
    </div>
  );
}

interface HorizontalAccordionProps {
  items: Array<{
    id: string;
    trigger: ReactNode;
    content: ReactNode;
  }>;
  className?: string;
  itemClassName?: string;
}

export function HorizontalAccordion({
  items,
  className = '',
  itemClassName = '',
}: HorizontalAccordionProps) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className={`flex gap-4 overflow-x-auto pb-4 ${className}`}>
      {items.map(item => (
        <HorizontalAccordionItem
          key={item.id}
          id={item.id}
          trigger={item.trigger}
          content={item.content}
          isActive={activeId === item.id}
          onToggle={() => setActiveId(activeId === item.id ? null : item.id)}
          className={itemClassName}
        />
      ))}
    </div>
  );
}

interface VerticalAccordionItemProps {
  id: string;
  trigger: ReactNode;
  content: ReactNode;
  isActive: boolean;
  onToggle: () => void;
  icon?: ReactNode;
}

function VerticalAccordionItem({
  id,
  trigger,
  content,
  isActive,
  onToggle,
  icon,
}: VerticalAccordionItemProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!contentRef.current) return;

    if (isActive) {
      gsap.to(contentRef.current, {
        height: 'auto',
        opacity: 1,
        pointerEvents: 'auto',
        duration: 0.4,
        ease: 'power2.out',
      });
    } else {
      gsap.to(contentRef.current, {
        height: 0,
        opacity: 0,
        pointerEvents: 'none',
        duration: 0.3,
        ease: 'power2.in',
      });
    }
  }, { dependencies: [isActive] });

  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        onClick={onToggle}
        aria-expanded={isActive}
        aria-controls={`content-${id}`}
        className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {icon && <div className="shrink-0">{icon}</div>}
          <span className="font-bold text-slate-900">{trigger}</span>
        </div>
        <ChevronRight
          className="w-5 h-5 text-slate-400 shrink-0 transition-transform"
          style={{
            transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      <div
        ref={contentRef}
        id={`content-${id}`}
        style={{ height: isActive ? 'auto' : 0, opacity: isActive ? 1 : 0 }}
        className="overflow-hidden"
      >
        <div className="px-6 pb-4 text-slate-600 text-sm leading-relaxed">
          {content}
        </div>
      </div>
    </div>
  );
}

interface VerticalAccordionProps {
  items: Array<{
    id: string;
    trigger: ReactNode;
    content: ReactNode;
    icon?: ReactNode;
  }>;
  allowMultiple?: boolean;
  className?: string;
}

export function VerticalAccordion({
  items,
  allowMultiple = false,
  className = '',
}: VerticalAccordionProps) {
  const [activeIds, setActiveIds] = useState<string[]>([items[0]?.id ?? '']);

  const handleToggle = (id: string) => {
    if (allowMultiple) {
      setActiveIds(prev =>
        prev.includes(id)
          ? prev.filter(aid => aid !== id)
          : [...prev, id]
      );
    } else {
      setActiveIds(prev => (prev.includes(id) ? [] : [id]));
    }
  };

  return (
    <div className={`rounded-lg border border-slate-200 bg-white overflow-hidden ${className}`}>
      {items.map(item => (
        <VerticalAccordionItem
          key={item.id}
          id={item.id}
          trigger={item.trigger}
          content={item.content}
          icon={item.icon}
          isActive={activeIds.includes(item.id)}
          onToggle={() => handleToggle(item.id)}
        />
      ))}
    </div>
  );
}
