import { type ReactNode } from 'react';

interface BentoItemProps {
  children: ReactNode;
  colSpan?: 1 | 2 | 3;
  rowSpan?: 1 | 2 | 3;
  className?: string;
}

function BentoItem({
  children,
  colSpan = 1,
  rowSpan = 1,
  className = '',
}: BentoItemProps) {
  const colClass = {
    1: 'col-span-1',
    2: 'md:col-span-2',
    3: 'md:col-span-3',
  }[colSpan];

  const rowClass = {
    1: 'row-span-1',
    2: 'md:row-span-2',
    3: 'md:row-span-3',
  }[rowSpan];

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:shadow-lg hover:border-slate-300 ${colClass} ${rowClass} ${className}`}
      data-stack-card
    >
      {children}
    </div>
  );
}

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export function BentoGrid({ children, className = '' }: BentoGridProps) {
  return (
    <div
      className={`grid gap-4 auto-rows-[minmax(200px,auto)] grid-flow-dense md:grid-cols-3 ${className}`}
      style={{
        gridAutoFlow: 'dense',
      }}
    >
      {children}
    </div>
  );
}

export function BentoContainer({ children }: { children: ReactNode }) {
  return (
    <section className="w-full px-6 py-16 md:px-12 lg:px-16 bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-7xl">
        {children}
      </div>
    </section>
  );
}

export function BentoHeader({
  title,
  description,
  className = '',
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={`mb-12 max-w-2xl ${className}`}>
      <h2 className="text-4xl font-black tracking-[-0.055em] md:text-5xl text-slate-950">
        {title}
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-slate-600">
        {description}
      </p>
    </div>
  );
}

export { BentoItem };
