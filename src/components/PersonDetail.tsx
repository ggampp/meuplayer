import { useEffect } from "react";
import type { MediaItem, PersonData, PersonRef } from "../types/media";
import { IMAGE_BASE } from "../lib/constants";
import { KnownForCard } from "./KnownForCard";

export interface PersonDetailProps {
  person: PersonRef;
  data: PersonData | null;
  hasParentDetail: boolean;
  onBack: () => void;
  onSelectWork: (work: MediaItem) => void;
}

function formatPersonMeta(details: PersonData["details"]): string[] {
  if (!details) return [];
  const lines: string[] = [];
  if (details.birthday) {
    const born = details.deathday
      ? `${details.birthday} — ${details.deathday}`
      : details.birthday;
    lines.push(`Nascimento: ${born}`);
  }
  if (details.place_of_birth) lines.push(details.place_of_birth);
  if (details.known_for_department) lines.push(details.known_for_department);
  return lines;
}

export function PersonDetail({
  person,
  data,
  hasParentDetail,
  onBack,
  onSelectWork,
}: PersonDetailProps) {
  const profileUrl = person.profile_path
    ? `${IMAGE_BASE}${person.profile_path}`
    : null;
  const details = data ? data.details : null;
  const works = data ? data.works : [];
  const loading = !data;
  const metaLines = formatPersonMeta(details);
  const biography = details?.biography?.trim() || "";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [person.id]);

  return (
    <main>
      <article className="detail detail--person">
        <div className="detail__content">
          <button type="button" className="detail__back" onClick={onBack}>
            {hasParentDetail ? "← Voltar ao título" : "← Voltar ao catálogo"}
          </button>

          <div className="detail__layout">
            <div
              className="detail__poster detail__poster--profile"
              style={profileUrl ? { backgroundImage: `url(${profileUrl})` } : undefined}
            >
              {!profileUrl ? (
                <span className="cast-card__initials">
                  {(person.name || "?").charAt(0)}
                </span>
              ) : null}
            </div>

            <div className="detail__info detail__info--person">
              <h1 className="detail__title">{person.name}</h1>
              {person.character ? (
                <p className="detail__subtitle">Como {person.character}</p>
              ) : null}

              {metaLines.length ? (
                <div className="detail__meta detail__meta--stacked">
                  {metaLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              ) : null}

              <div className="detail__bio-block">
                <h2 className="detail__bio-heading">Biografia</h2>
                {loading ? (
                  <p className="detail__overview">Carregando biografia…</p>
                ) : (
                  <p className="detail__overview">
                    {biography || "Biografia não disponível."}
                  </p>
                )}
              </div>
            </div>
          </div>

          <section className="detail__section">
            <div className="detail__section-heading">
              <h2 className="detail__section-title">Conhecido(a) por</h2>
            </div>
            {loading ? (
              <p className="detail__section-status">Carregando obras…</p>
            ) : works.length ? (
              <div className="known-for-scroll">
                {works.map((work) => (
                  <KnownForCard
                    key={`${work.type}-${work.id}`}
                    work={work}
                    onSelect={onSelectWork}
                  />
                ))}
              </div>
            ) : (
              <p className="detail__section-status">
                Nenhuma obra com capa encontrada.
              </p>
            )}
          </section>
        </div>
      </article>
    </main>
  );
}
