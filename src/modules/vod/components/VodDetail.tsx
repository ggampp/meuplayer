// @ts-nocheck — extracted legacy presentation; state is owned by VodApp.

import { BACKDROP_BASE, IMAGE_BASE, STILL_BASE } from "../lib/constants";

import { hasMultipleSeasons, pickYear, typeLabel } from "../lib/media";
import { CastCard, MediaCard } from "../components";

export function VodDetail({ genres, selected, seasonNumber, setSeasonNumber, seasonData, relatedItems, castData, setSelectedPerson, selectedMeta, seasonList, openModal, openDetail, closeDetail }) {
    if (!selected) return null;
    const title = selectedMeta?.title || selectedMeta?.name || selected.id;
    const subtitle =
      selectedMeta?.original_title ||
      selectedMeta?.original_name ||
      "Título original não informado";
    const year = pickYear(selectedMeta);
    const rating = selectedMeta?.vote_average?.toFixed?.(1) || "—";
    const runtime =
      selectedMeta?.runtime ||
      selectedMeta?.episode_run_time?.[0] ||
      null;
    const backdropPath = selectedMeta?.backdrop_path
      ? `${BACKDROP_BASE}${selectedMeta.backdrop_path}`
      : "";
    const posterPath = selectedMeta?.poster_path
      ? `${IMAGE_BASE}${selectedMeta.poster_path}`
      : "";

    return (
          <article className="detail">
            <div
              className="detail__backdrop"
              style={backdropPath ? { backgroundImage: `url(${backdropPath})` } : undefined}
              aria-hidden="true"
            />
            <div className="detail__content">
              <button type="button" className="detail__back" onClick={closeDetail}>
                ← Voltar ao catálogo
              </button>

              <div className="detail__layout">
                <div
                  className="detail__poster"
                  style={posterPath ? { backgroundImage: `url(${posterPath})` } : undefined}
                >
                  {!posterPath ? <span className="card__placeholder">Sem capa</span> : null}
                </div>

                <div className="detail__info">
                  <p className="detail__eyebrow">
                    {typeLabel(selected.type)}
                    {year ? ` · ${year}` : ""}
                  </p>
                  <h1 className="detail__title">{title}</h1>
                  <p className="detail__subtitle">{subtitle}</p>

                  <div className="detail__meta">
                    <span>
                      Nota <strong>{rating}</strong>
                    </span>
                    {runtime ? (
                      <span>
                        Duração <strong>{runtime} min</strong>
                      </span>
                    ) : null}
                    {selectedMeta?.number_of_seasons ? (
                      <span>
                        Temporadas <strong>{selectedMeta.number_of_seasons}</strong>
                      </span>
                    ) : null}
                  </div>

                  {(selectedMeta?.genres || []).length ? (
                    <div className="detail__genres">
                      {selectedMeta.genres.map((genre) => (
                        <span key={genre.id}>{genre.name}</span>
                      ))}
                    </div>
                  ) : null}

                  <p className="detail__overview">
                    {selectedMeta?.overview || "Sinopse não informada."}
                  </p>

                  <div className="detail__actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => openModal(selected)}
                    >
                      Assistir
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={closeDetail}
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              </div>

              {castData.length > 0 ? (
                <section className="detail__section">
                  <div className="detail__section-heading">
                    <h2 className="detail__section-title">Elenco</h2>
                  </div>
                  <div className="cast-scroll">
                    {castData.map((member) => (
                      <CastCard
                        key={member.id}
                        member={member}
                        onClick={() => setSelectedPerson({
                          id: String(member.id),
                          name: member.name,
                          character: member.character,
                          profile_path: member.profile_path,
                        })}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {selected.type !== "movie" ? (
                <section className="detail__section">
                  <div className="detail__section-heading">
                    <h2 className="detail__section-title">Temporadas</h2>
                    {seasonList.length > 1 || hasMultipleSeasons(selectedMeta) ? (
                      <select
                        className="detail__season-select"
                        value={seasonNumber}
                        onChange={(event) => setSeasonNumber(event.target.value)}
                        aria-label="Selecionar temporada"
                        disabled={!seasonList.length}
                      >
                        {!seasonList.length ? (
                          <option value={seasonNumber}>Carregando…</option>
                        ) : null}
                        {seasonList.map((season) => (
                          <option
                            key={season.season_number}
                            value={season.season_number}
                          >
                            {season.name || `Temporada ${season.season_number}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="detail__season-label">
                        Temporada {seasonList[0]?.season_number || 1}
                      </span>
                    )}
                  </div>

                  <ol className="episodes">
                    {(seasonData?.episodes || []).map((episode) => (
                      <li key={episode.id}>
                        <button
                          type="button"
                          className="episode"
                          onClick={() =>
                            openModal(
                              { id: selected.id, type: selected.type },
                              String(episode.season_number || seasonNumber),
                              String(episode.episode_number)
                            )
                          }
                        >
                          <div
                            className="episode__image"
                            style={
                              episode.still_path
                                ? { backgroundImage: `url(${STILL_BASE}${episode.still_path})` }
                                : undefined
                            }
                          >
                            {!episode.still_path ? (
                              <span className="card__placeholder">Sem still</span>
                            ) : null}
                            {episode.runtime ? (
                              <span className="episode__runtime">{episode.runtime} min</span>
                            ) : null}
                          </div>
                          <div className="episode__body">
                            <span className="episode__number">
                              T{episode.season_number} · E{episode.episode_number}
                            </span>
                            <span className="episode__title">{episode.name}</span>
                            <p className="episode__overview">
                              {episode.overview || "Sem sinopse."}
                            </p>
                          </div>
                          <span className="episode__chevron" aria-hidden="true">
                            →
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {relatedItems.length ? (
                <section className="detail__section">
                  <div className="detail__section-heading">
                    <h2 className="detail__section-title">Itens relacionados</h2>
                  </div>
                  <div className="detail__related-grid">
                    {relatedItems.map((item) => (
                      <MediaCard
                        key={`${item.type}-${item.id}`}
                        item={item}
                        meta={item.meta || {}}
                        onSelect={openDetail}
                        compact
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </article>
    );
  }
