import type { MediaItem } from "../types/media";
import { IMAGE_BASE } from "../lib/constants";

export interface KnownForCardProps {
  work: MediaItem;
  onSelect: (work: MediaItem) => void;
}

export function KnownForCard({ work, onSelect }: KnownForCardProps) {
  const meta = work.meta || {};
  const title = meta.title || meta.name || work.id;
  const posterUrl = meta.poster_path ? `${IMAGE_BASE}${meta.poster_path}` : null;
  const role = meta.character || meta.job || null;
  return (
    <button type="button" className="known-for-card" onClick={() => onSelect(work)}>
      <div className="known-for-card__poster">
        {posterUrl ? (
          <img src={posterUrl} alt={String(title)} loading="lazy" />
        ) : (
          <span className="cast-card__initials">{(String(title) || "?").charAt(0)}</span>
        )}
      </div>
      <p className="known-for-card__title">{title}</p>
      {role ? <p className="known-for-card__role">{role}</p> : null}
    </button>
  );
}
