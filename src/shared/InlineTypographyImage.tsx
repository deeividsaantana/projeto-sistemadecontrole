import { type ReactNode, createElement } from 'react';

interface InlineImageProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function InlineImage({ src, alt, size = 'md', className = '' }: InlineImageProps) {
  const sizeClass = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }[size];

  return (
    <span
      className={`inline-block align-middle rounded-full overflow-hidden mx-1 ${sizeClass} ${className}`}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
      />
    </span>
  );
}

interface InlineTypographyHeadingProps {
  children: ReactNode;
  imageUrl?: string;
  imageAlt?: string;
  imageSize?: 'sm' | 'md' | 'lg';
  className?: string;
  level?: 'h1' | 'h2' | 'h3';
}

export function InlineTypographyHeading({
  children,
  imageUrl,
  imageAlt = 'inline image',
  imageSize = 'md',
  className = '',
  level = 'h2',
}: InlineTypographyHeadingProps) {
  const headingClass = {
    h1: 'text-5xl font-black tracking-[-0.055em]',
    h2: 'text-4xl font-black tracking-[-0.05em]',
    h3: 'text-3xl font-bold tracking-[-0.035em]',
  }[level];

  const content = typeof children === 'string' && imageUrl
    ? children.split('|').map((part, idx) =>
      idx === 1
        ? (
          <span key={idx}>
            <InlineImage src={imageUrl} alt={imageAlt} size={imageSize} />
            {part}
          </span>
        )
        : part,
    )
    : children;

  return createElement(
    level,
    { className: `${headingClass} ${className}` },
    content
  );
}

interface InlineTypographyLabelProps {
  children: ReactNode;
  imageUrl?: string;
  imageAlt?: string;
  imageSize?: 'sm' | 'md';
  className?: string;
  variant?: 'default' | 'accent' | 'muted';
}

export function InlineTypographyLabel({
  children,
  imageUrl,
  imageAlt = 'inline image',
  imageSize = 'sm',
  className = '',
  variant = 'default',
}: InlineTypographyLabelProps) {
  const variantClass = {
    default: 'text-xs font-semibold uppercase tracking-[0.08em] text-slate-700',
    accent: 'text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700',
    muted: 'text-xs font-semibold uppercase tracking-[0.08em] text-slate-500',
  }[variant];

  return (
    <span className={`inline-flex items-center gap-1 ${variantClass} ${className}`}>
      {imageUrl && <InlineImage src={imageUrl} alt={imageAlt} size={imageSize} />}
      {children}
    </span>
  );
}

interface InlineTypographyCardProps {
  title: ReactNode;
  description: ReactNode;
  imageUrl?: string;
  imageAlt?: string;
  imageSize?: 'md' | 'lg';
  className?: string;
  icon?: ReactNode;
}

export function InlineTypographyCard({
  title,
  description,
  imageUrl,
  imageAlt = 'inline image',
  imageSize = 'md',
  className = '',
  icon,
}: InlineTypographyCardProps) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 ${className}`}>
      {imageUrl && (
        <div className="mb-4 flex justify-center">
          <InlineImage src={imageUrl} alt={imageAlt} size={imageSize} />
        </div>
      )}
      <div className="flex items-start gap-3">
        {icon && <div className="mt-1">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
        </div>
      </div>
    </div>
  );
}

interface InlineTypographyFeatureProps {
  imageUrl: string;
  imageAlt?: string;
  title: string;
  description: string;
  reversed?: boolean;
  className?: string;
}

export function InlineTypographyFeature({
  imageUrl,
  imageAlt = 'feature image',
  title,
  description,
  reversed = false,
  className = '',
}: InlineTypographyFeatureProps) {
  return (
    <div
      className={`grid gap-8 items-center md:grid-cols-2 ${reversed ? 'md:grid-cols-[1fr_auto]' : ''} ${className}`}
    >
      <div className={reversed ? 'md:order-last' : ''}>
        <span className="inline-block px-3 py-1 mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 bg-emerald-50 rounded-full">
          Funcionalidade
        </span>
        <h3 className="text-3xl font-black tracking-[-0.035em] text-slate-900">
          {title}
        </h3>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          {description}
        </p>
      </div>
      <div className="flex justify-center">
        <img
          src={imageUrl}
          alt={imageAlt}
          className="rounded-xl shadow-lg max-w-sm w-full h-auto object-cover"
        />
      </div>
    </div>
  );
}

export { InlineImage };
