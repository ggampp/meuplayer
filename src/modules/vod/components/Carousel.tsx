import { useRef } from "react";
import type { MediaItem } from "../types/media";
import { MediaCard } from "./MediaCard";

export interface CarouselProps {
  title: string;
  eyebrow?: string;
  status?: string;
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  hasMore?: boolean;
  onMore?: () => void;
}

export function Carousel({
  title,
  eyebrow,
  status,
  items,
  onSelect,
  hasMore,
  onMore,
}: CarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollByPage = (direction: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="nf-row" aria-labelledby={`nf-row-${title}`}>
      <header className="nf-row__header">
        <h2 className="nf-row__title" id={`nf-row-${title}`}>
          {title}
        </h2>
        {eyebrow ? <span className="nf-row__status">{eyebrow}</span> : null}
      </header>
      {items.length ? (
        <div className="nf-row__viewport">
          <button
            type="button"
            className="nf-row__arrow nf-row__arrow--left"
            onClick={() => scrollByPage(-1)}
            aria-label="Anterior"
          >
            ‹
          </button>
          <div className="nf-row__track" ref={trackRef}>
            {items.map((item) => (
              <MediaCard
                key={`${item.type}-${item.id}`}
                item={item}
                meta={item.meta || {}}
                onSelect={onSelect}
              />
            ))}
            {hasMore ? (
              <button type="button" className="nf-row__more-card" onClick={onMore}>
                Mais
                <br />
                {title.toLowerCase()} →
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="nf-row__arrow nf-row__arrow--right"
            onClick={() => scrollByPage(1)}
            aria-label="Próximo"
          >
            ›
          </button>
        </div>
      ) : (
        <div className="row__empty">{status || "Nenhum item encontrado."}</div>
      )}
    </section>
  );
}
