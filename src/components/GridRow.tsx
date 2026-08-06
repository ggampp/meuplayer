import type { MediaItem } from "../types/media";
import { MediaCard } from "./MediaCard";

export interface GridRowProps {
  title: string;
  eyebrow?: string;
  status?: string;
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  hasMore?: boolean;
  onMore?: () => void;
}

export function GridRow({
  title,
  eyebrow,
  status,
  items,
  onSelect,
  hasMore,
  onMore,
}: GridRowProps) {
  return (
    <section className="row" aria-labelledby={`row-${title}`}>
      <header className="row__header">
        <h2 className="row__title" id={`row-${title}`}>
          {title}
        </h2>
        <span className="row__status">{eyebrow}</span>
      </header>
      <div className="row__grid">
        {items.length ? (
          items.map((item) => (
            <MediaCard
              key={`${item.type}-${item.id}`}
              item={item}
              meta={item.meta || {}}
              onSelect={onSelect}
            />
          ))
        ) : (
          <div className="row__empty">{status || "Nenhum item encontrado."}</div>
        )}
      </div>
      {hasMore ? (
        <button type="button" className="row__more" onClick={onMore}>
          Mais {title.toLowerCase()}
        </button>
      ) : null}
    </section>
  );
}
