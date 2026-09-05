import type { MediaItem, MediaMeta } from "../types/media";
import { IMAGE_BASE } from "../lib/constants";
import { displayTitle, pickYear, typeLabel } from "../lib/media";

export interface MediaCardProps {
  item: MediaItem;
  meta?: MediaMeta;
  onSelect: (item: MediaItem) => void;
  compact?: boolean;
}

export function MediaCard({ item, meta, onSelect, compact = false }: MediaCardProps) {
  const resolved = meta || item.meta || {};
  const title = displayTitle(resolved, item.id);
  const originalTitle =
    resolved.original_title || resolved.original_name || title;
  const year = pickYear(resolved);
  const posterPath = resolved.poster_path ? `${IMAGE_BASE}${resolved.poster_path}` : "";
  const overview = resolved.overview || "Sinopse não disponível.";
  const sameTitle = originalTitle === title;

  return (
    <button
      type="button"
      className={`card${compact ? " card--compact" : ""}`}
      onClick={() => onSelect(item)}
      aria-label={`Abrir ${title}`}
    >
      <div className="card__media">
        {posterPath ? (
          <img src={posterPath} alt={title} loading="lazy" />
        ) : (
          <span className="card__placeholder">Sem capa</span>
        )}
      </div>
      <div className="card__veil">
        <h3 className="card__title">{title}</h3>
        <span className="card__meta">
          {typeLabel(item.type)}
          {year ? ` · ${year}` : ""}
          {!sameTitle ? ` · ${originalTitle}` : ""}
        </span>
        {!compact ? <p className="card__overview">{overview}</p> : null}
        <span className="card__cta">Abrir →</span>
      </div>
    </button>
  );
}
