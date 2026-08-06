import type { MediaItem } from "../types/media";
import { BACKDROP_BASE } from "../lib/constants";
import { pickYear, typeLabel } from "../lib/media";

export interface HeroProps {
  featured: MediaItem | null;
  onWatch: (item: MediaItem) => void;
}

export function Hero({ featured, onWatch }: HeroProps) {
  if (!featured) {
    return (
      <section className="hero" aria-label="Destaque">
        <div className="hero__bloom" aria-hidden="true" />
        <p className="hero__eyebrow">MeuPlayer</p>
        <h1 className="hero__title">
          Um cinema <em>pessoal</em>, sem alarde.
        </h1>
        <p className="hero__subtitle">
          Filmes, séries e animes do TMDB tocados via SuperFlix — sem
          recomendações forçadas, sem perfis, sem anúncios.
        </p>
      </section>
    );
  }

  const meta = featured.meta || {};
  const title = meta.title || meta.name || featured.id;
  const year = pickYear(meta);
  const overview = meta.overview || "";
  const backdropPath = meta.backdrop_path
    ? `${BACKDROP_BASE}${meta.backdrop_path}`
    : "";
  const backdropStyle = backdropPath
    ? { backgroundImage: `url(${backdropPath})` }
    : undefined;

  return (
    <section className="hero" aria-label="Destaque do catálogo">
      <div className="hero__backdrop" style={backdropStyle} aria-hidden="true" />
      <div className="hero__bloom" aria-hidden="true" />
      <p className="hero__eyebrow">
        {typeLabel(featured.type)}
        {year ? ` · ${year}` : ""}
      </p>
      <h1 className="hero__title">{title}</h1>
      {overview ? (
        <p className="hero__subtitle">
          {overview.length > 220 ? overview.slice(0, 220) + "…" : overview}
        </p>
      ) : null}
      <div className="hero__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onWatch(featured)}
        >
          Abrir detalhes
        </button>
      </div>
    </section>
  );
}
