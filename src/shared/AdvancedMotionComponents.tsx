import { useRef, useEffect, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface MarqueeProps {
  children: ReactNode;
  speed?: number;
  direction?: 'left' | 'right';
  className?: string;
}

export function InfiniteMarquee({ children, speed = 30, direction = 'left', className = '' }: MarqueeProps) {
  const marqueeRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!marqueeRef.current || !contentRef.current) return;

    const marquee = marqueeRef.current;
    const content = contentRef.current;

    gsap.set(content, { x: 0 });

    const tl = gsap.timeline({ repeat: -1 });
    const marqueeWidth = marquee.offsetWidth;
    const contentWidth = content.offsetWidth;
    const distance = contentWidth + marqueeWidth;

    if (direction === 'left') {
      tl.to(content, {
        x: -distance,
        duration: distance / speed,
        ease: 'none',
      })
        .set(content, { x: marqueeWidth }, 0);
    } else {
      tl.to(content, {
        x: distance,
        duration: distance / speed,
        ease: 'none',
      })
        .set(content, { x: -contentWidth }, 0);
    }
  }, { scope: marqueeRef });

  return (
    <div
      ref={marqueeRef}
      className={`overflow-hidden ${className}`}
    >
      <div ref={contentRef} className="flex whitespace-nowrap">
        {children}
      </div>
    </div>
  );
}

interface ImageScrollRevealProps {
  src: string;
  alt: string;
  className?: string;
}

export function ImageScrollReveal({ src, alt, className = '' }: ImageScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useGSAP(() => {
    if (!imageRef.current || !containerRef.current) return;

    gsap.fromTo(
      imageRef.current,
      { scale: 0.8, opacity: 0.3 },
      {
        scale: 1,
        opacity: 1,
        duration: 1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top 80%',
          end: 'top 20%',
          scrub: 0.5,
          markers: false,
        },
      }
    );

    gsap.to(imageRef.current, {
      opacity: 0.2,
      scale: 1.1,
      ease: 'none',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'bottom 20%',
        end: 'bottom top',
        scrub: 0.5,
      },
    });
  }, { scope: containerRef });

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden ${className}`}
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

interface CardStackProps {
  children: ReactNode[];
  className?: string;
  triggerElement?: string;
}

export function CardStack({ children, className = '', triggerElement }: CardStackProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    const cards = containerRef.current.querySelectorAll('[data-stack-card]');
    if (cards.length === 0) return;

    cards.forEach((card, index) => {
      gsap.fromTo(
        card,
        {
          opacity: 0,
          y: 40,
          rotationX: -20,
        },
        {
          opacity: 1,
          y: 0,
          rotationX: 0,
          duration: 0.6,
          delay: index * 0.15,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: triggerElement || containerRef.current!,
            start: 'top 75%',
            once: true,
          },
        }
      );
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

interface TextRevealProps {
  children: string;
  className?: string;
  triggerElement?: string;
}

export function TextReveal({ children, className = '', triggerElement }: TextRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const words = children.split(' ');

  useGSAP(() => {
    if (!containerRef.current) return;

    const spans = containerRef.current.querySelectorAll('span');
    if (spans.length === 0) return;

    gsap.fromTo(
      spans,
      { opacity: 0.1, y: 10 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.05,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: triggerElement || containerRef.current,
          start: 'top 80%',
          once: true,
        },
      }
    );
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className={className}>
      {words.map((word, idx) => (
        <span key={idx} className="inline-block mr-1">
          {word}
        </span>
      ))}
    </div>
  );
}

interface HorizontalScrollRevealProps {
  children: ReactNode;
  className?: string;
}

export function HorizontalScrollReveal({ children, className = '' }: HorizontalScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!scrollContainerRef.current || !containerRef.current) return;

    const scrollWidth = scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth;

    gsap.to(scrollContainerRef.current, {
      x: -scrollWidth,
      ease: 'none',
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top center',
        end: 'bottom center',
        scrub: 1,
        markers: false,
      },
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      <div
        ref={scrollContainerRef}
        className="flex gap-6 w-max"
      >
        {children}
      </div>
    </div>
  );
}

interface PinSectionProps {
  children: ReactNode;
  className?: string;
  duration?: number;
}

export function PinSection({ children, className = '', duration = 300 }: PinSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top top',
      end: `+=${duration}`,
      pin: true,
      pinSpacing: false,
      markers: false,
    });

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

interface CounterAnimatedProps {
  from: number;
  to: number;
  duration?: number;
  className?: string;
  suffix?: string;
  triggerElement?: string;
}

export function CounterAnimated({
  from,
  to,
  duration = 2,
  className = '',
  suffix = '',
  triggerElement,
}: CounterAnimatedProps) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!valueRef.current || !containerRef.current) return;

    const obj = { value: from };

    gsap.to(obj, {
      value: to,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        if (valueRef.current) {
          valueRef.current.textContent = Math.round(obj.value).toLocaleString('pt-BR') + suffix;
        }
      },
      scrollTrigger: {
        trigger: triggerElement || containerRef.current,
        start: 'top 80%',
        once: true,
      },
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className={className}>
      <span ref={valueRef}>{from}{suffix}</span>
    </div>
  );
}

interface GlitchTextProps {
  children: string;
  className?: string;
}

export function GlitchText({ children, className = '' }: GlitchTextProps) {
  const textRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!textRef.current) return;

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 5 });

    tl.to(textRef.current, {
      duration: 0.08,
      ease: 'power2.inOut',
      letterSpacing: '0.1em',
      opacity: 0.8,
      textShadow: '2px 2px 0px #f26a2e, -2px -2px 0px #16865b',
    })
      .to(textRef.current, {
        duration: 0.06,
        ease: 'power2.inOut',
        letterSpacing: '0em',
        opacity: 1,
        textShadow: 'none',
      }, 0.12);
  }, { scope: textRef });

  return (
    <div
      ref={textRef}
      className={`transition-all ${className}`}
    >
      {children}
    </div>
  );
}
