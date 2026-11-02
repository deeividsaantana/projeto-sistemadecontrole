import { useEffect, useRef, useState } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabNavigationProps {
  items: readonly TabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Componente de navegação entre abas com suporte a Tab/Shift+Tab.
 * Permite trocar de aba usando o teclado (Tab para próxima, Shift+Tab para anterior)
 * ou clicando na aba desejada.
 *
 * Uso:
 * ```tsx
 * const [activeTab, setActiveTab] = useState('tab1');
 * <TabNavigation
 *   items={[
 *     { id: 'tab1', label: 'Aba 1', icon: <IconComponent /> },
 *     { id: 'tab2', label: 'Aba 2', icon: <IconComponent /> }
 *   ]}
 *   activeId={activeTab}
 *   onSelect={setActiveTab}
 * />
 * ```
 */
export function TabNavigation({ items, activeId, onSelect, className = '' }: TabNavigationProps) {
  const [focusIndex, setFocusIndex] = useState(
    Math.max(0, items.findIndex(i => i.id === activeId))
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Atualiza o índice de foco quando a aba ativa muda externamente
    const index = items.findIndex(i => i.id === activeId);
    if (index >= 0) {
      setFocusIndex(index);
    }
  }, [activeId, items]);

  useEffect(() => {
    const handleTabNav = (event: KeyboardEvent) => {
      // Só reage a Tab se não estiver digitando em input/textarea
      if (event.key !== 'Tab') return;

      const target = event.target as HTMLElement;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        (target instanceof HTMLElement && target.contentEditable === 'true')
      ) {
        return;
      }

      // Verifica se o foco está dentro do container de abas
      if (!containerRef.current?.contains(target)) {
        return;
      }

      let newIndex = focusIndex;
      if (event.shiftKey) {
        newIndex = focusIndex === 0 ? items.length - 1 : focusIndex - 1;
      } else {
        newIndex = focusIndex === items.length - 1 ? 0 : focusIndex + 1;
      }

      setFocusIndex(newIndex);
      onSelect(items[newIndex].id);
      event.preventDefault();
    };

    window.addEventListener('keydown', handleTabNav);
    return () => window.removeEventListener('keydown', handleTabNav);
  }, [focusIndex, items, onSelect]);

  const handleButtonClick = (index: number, id: string) => {
    setFocusIndex(index);
    onSelect(id);
  };

  return (
    <div
      ref={containerRef}
      className={`flex gap-2 border-b border-slate-200 ${className}`}
      role="tablist"
      aria-label="Navegação de abas"
    >
      {items.map((item, idx) => (
        <button
          key={item.id}
          onClick={() => handleButtonClick(idx, item.id)}
          onKeyDown={(e) => {
            // Quando focado via Tab, permite navegar com setas também
            if (e.key === 'ArrowRight') {
              const nextIdx = idx === items.length - 1 ? 0 : idx + 1;
              setFocusIndex(nextIdx);
              onSelect(items[nextIdx].id);
              e.preventDefault();
            } else if (e.key === 'ArrowLeft') {
              const prevIdx = idx === 0 ? items.length - 1 : idx - 1;
              setFocusIndex(prevIdx);
              onSelect(items[prevIdx].id);
              e.preventDefault();
            }
          }}
          tabIndex={idx === focusIndex ? 0 : -1}
          aria-selected={item.id === activeId}
          role="tab"
          className={`flex items-center gap-2 px-4 py-2 font-medium transition whitespace-nowrap ${
            item.id === activeId
              ? 'border-b-2 border-emerald-600 text-emerald-700'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {item.icon && <span className="flex items-center" aria-hidden="true">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}
