import { useRef, useEffect, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { reduzMovimento } from '../shared/motion/reduzMovimento';

interface LoginCarouselProps {
  images: string[];
  autoplay?: boolean;
  interval?: number;
}

export function LoginCarousel({
  images,
  autoplay = true,
  interval = 5000,
}: LoginCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const currentIndexRef = useRef(0);
  const autoplayTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const timelineRef = useRef<gsap.core.Timeline | undefined>(undefined);

  const goToSlide = (index: number) => {
    if (!trackRef.current) return;

    const totalSlides = images.length;
    const newIndex = ((index % totalSlides) + totalSlides) % totalSlides;
    currentIndexRef.current = newIndex;

    // Kill existing timeline
    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    const shouldAnimate = !reduzMovimento();
    const duration = shouldAnimate ? 0.6 : 0;
    const ease = shouldAnimate ? 'power3.inOut' : 'none';

    timelineRef.current = gsap.timeline();
    timelineRef.current.to(trackRef.current, {
      x: -newIndex * 100,
      duration,
      ease,
    });

    // Update dots
    dotsRef.current.forEach((dot, idx) => {
      if (dot) {
        if (idx === newIndex) {
          dot.setAttribute('aria-current', 'true');
          dot.classList.add('bg-white');
          dot.classList.remove('bg-white/40');
        } else {
          dot.setAttribute('aria-current', 'false');
          dot.classList.remove('bg-white');
          dot.classList.add('bg-white/40');
        }
      }
    });

    // Reset autoplay
    if (autoplayTimeoutRef.current) {
      clearTimeout(autoplayTimeoutRef.current);
    }
    if (autoplay) {
      autoplayTimeoutRef.current = setTimeout(() => {
        goToSlide(newIndex + 1);
      }, interval);
    }
  };

  useGSAP(() => {
    if (!trackRef.current || reduzMovimento()) return;

    if (autoplay) {
      autoplayTimeoutRef.current = setTimeout(() => {
        goToSlide(1);
      }, interval);
    }

    return () => {
      if (autoplayTimeoutRef.current) {
        clearTimeout(autoplayTimeoutRef.current);
      }
    };
  }, { scope: containerRef });

  const handleDotClick = (index: number) => {
    goToSlide(index);
  };

  const handlePrevious = () => {
    goToSlide(currentIndexRef.current - 1);
  };

  const handleNext = () => {
    goToSlide(currentIndexRef.current + 1);
  };

  return (
    <div
      ref={containerRef}
      className="login-carousel relative w-full h-full overflow-hidden bg-slate-900"
      role="region"
      aria-label="Carrossel de fotos da obra"
    >
      {/* Track */}
      <div
        ref={trackRef}
        className="login-carousel__track flex w-full h-full"
        style={{ width: `${images.length * 100}%` }}
      >
        {images.map((image, index) => (
          <div
            key={index}
            className="login-carousel__slide flex-shrink-0 w-full h-full relative overflow-hidden"
            style={{ width: `${100 / images.length}%` }}
          >
            <img
              src={image}
              alt={`Foto da obra ${index + 1}`}
              className="w-full h-full object-cover"
            />
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
          </div>
        ))}
      </div>

      {/* Navigation dots */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2"
        role="tablist"
        aria-label="Slides do carrossel"
      >
        {images.map((_, index) => (
          <button
            key={index}
            ref={(el) => {
              dotsRef.current[index] = el;
            }}
            onClick={() => handleDotClick(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === 0 ? 'bg-white' : 'bg-white/40'
            }`}
            aria-current={index === 0 ? 'true' : 'false'}
            aria-label={`Ir para slide ${index + 1}`}
            role="tab"
          />
        ))}
      </div>

      {/* Navigation buttons - hidden on mobile */}
      <button
        onClick={handlePrevious}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 hidden md:flex w-10 h-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors duration-200"
        aria-label="Slide anterior"
        title="Slide anterior (seta esquerda)"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      <button
        onClick={handleNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 hidden md:flex w-10 h-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors duration-200"
        aria-label="Próximo slide"
        title="Próximo slide (seta direita)"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
}
