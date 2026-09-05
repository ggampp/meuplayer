// @ts-nocheck — extracted legacy presentation; state is owned by VodApp.

import { hasMultipleSeasons, typeLabel } from "../lib/media";

export function VodPlayer({ modal, setModal, modalSeason, setModalSeason, modalEpisode, setModalEpisode, modalChromeVisible, playerProvider, setPlayerProvider, hideModalChromeSoon, revealModalChrome, keepModalChromeVisible, modalMeta, modalSeasonList, modalEpisodes, closeModal, playerUrl }) {
    const backToDetailLabel =
      modal.type === "movie" ? "Voltar aos detalhes do filme" : "Voltar aos detalhes";

    return (
      <div
        className={`modal modal--immersive ${modal.open ? "is-open" : ""} ${modalChromeVisible ? "modal--chrome-visible" : ""}`}
        aria-hidden={!modal.open}
        onMouseMove={modal.open ? revealModalChrome : undefined}
        onPointerMove={modal.open ? revealModalChrome : undefined}
        onFocusCapture={keepModalChromeVisible}
        onBlurCapture={() => hideModalChromeSoon(1200)}
      >
        <div className="modal__overlay" onClick={closeModal}></div>
        <div className="modal__content" role="dialog" aria-label="Player de mídia">
          <div className="modal__header">
            <div>
              <h3 className="modal__title">
                Player · {typeLabel(modal.type === "movie" ? "movie" : "serie")}
              </h3>
            </div>
            <button type="button" className="modal__close" onClick={closeModal}>
              ← Voltar aos detalhes
            </button>
          </div>
          <div className="modal__controls">
            <div className="control">
              <label htmlFor="modalProvider">Player</label>
              <select
                id="modalProvider"
                value={playerProvider}
                onChange={(event) => setPlayerProvider(event.target.value)}
              >
                <option value="superflix">SuperFlix</option>
                <option value="vidsrc">Vidsrc</option>
              </select>
            </div>
            <div className="control">
              <label htmlFor="modalType">Tipo</label>
              <select
                id="modalType"
                value={modal.type}
                onChange={(event) =>
                  setModal({ ...modal, type: event.target.value })
                }
              >
                <option value="movie">Filme</option>
                <option value="serie">Série/Anime</option>
              </select>
            </div>
            <div className="control">
              <label htmlFor="modalId">ID</label>
              <input
                id="modalId"
                value={modal.id}
                onChange={(event) =>
                  setModal({ ...modal, id: event.target.value })
                }
              />
            </div>
            <div className="control">
              <label htmlFor="modalSeason">Temporada</label>
              {modal.type === "movie" ? (
                <input id="modalSeason" type="number" value="1" disabled readOnly />
              ) : modalSeasonList.length > 1 || hasMultipleSeasons(modalMeta) ? (
                <select
                  id="modalSeason"
                  value={modalSeason}
                  onChange={(event) => {
                    setModalSeason(event.target.value);
                    setModalEpisode("1");
                  }}
                  disabled={!modalSeasonList.length}
                >
                  {!modalSeasonList.length ? (
                    <option value={modalSeason}>Carregando…</option>
                  ) : null}
                  {modalSeasonList.map((season) => (
                    <option
                      key={season.season_number}
                      value={season.season_number}
                    >
                      {season.name || `Temporada ${season.season_number}`}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="modalSeason"
                  type="number"
                  min="1"
                  value={modalSeason}
                  onChange={(event) => {
                    setModalSeason(event.target.value);
                    setModalEpisode("1");
                  }}
                />
              )}
            </div>
            <div className="control">
              <label htmlFor="modalEpisode">Episódio</label>
              {modal.type === "movie" ? (
                <input id="modalEpisode" type="number" value="1" disabled readOnly />
              ) : modalEpisodes.length ? (
                <select
                  id="modalEpisode"
                  value={modalEpisode}
                  onChange={(event) => setModalEpisode(event.target.value)}
                >
                  {modalEpisodes.map((episode) => (
                    <option
                      key={episode.id || episode.episode_number}
                      value={episode.episode_number}
                    >
                      E{episode.episode_number}
                      {episode.name ? ` · ${episode.name}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="modalEpisode"
                  type="number"
                  min="1"
                  value={modalEpisode}
                  onChange={(event) => setModalEpisode(event.target.value)}
                  placeholder={modal.open ? "Carregando…" : ""}
                />
              )}
            </div>
            <div className="control control--action">
              <span className="control__spacer" aria-hidden="true">
                &nbsp;
              </span>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setModal({ ...modal })}
              >
                Atualizar
              </button>
            </div>
          </div>
          <div className="modal__player">
            <button
              type="button"
              className="modal__back-detail"
              onClick={closeModal}
              aria-label={backToDetailLabel}
            >
              ← {backToDetailLabel}
            </button>
            <button
              type="button"
              className="modal__back-detail modal__back-detail--fallback"
              onClick={() => setPlayerProvider((prev) => prev === "superflix" ? "vidsrc" : "superflix")}
            >
              Problema com o vídeo? Alternar Player ({playerProvider === "superflix" ? "Vidsrc" : "SuperFlix"})
            </button>
            <div
              className="modal__motion-catcher"
              aria-hidden="true"
              onMouseMove={revealModalChrome}
              onPointerMove={revealModalChrome}
            />
            {modal.open ? (
              <iframe
                id="playerFrame"
                title="Player de mídia"
                src={playerUrl}
                allowFullScreen
              ></iframe>
            ) : null}
            {modal.open && modal.type !== "movie" ? (
              <div
                className="modal__quick-controls"
                aria-label="Selecao rapida de temporada e episodio"
              >
                <label className="modal__quick-field" title="Temporada">
                  <span>T</span>
                  {modalSeasonList.length > 1 || hasMultipleSeasons(modalMeta) ? (
                    <select
                      value={modalSeason}
                      onChange={(event) => {
                        setModalSeason(event.target.value);
                        setModalEpisode("1");
                      }}
                      disabled={!modalSeasonList.length}
                      aria-label="Selecionar temporada"
                    >
                      {!modalSeasonList.length ? (
                        <option value={modalSeason}>...</option>
                      ) : null}
                      {modalSeasonList.map((season) => (
                        <option
                          key={season.season_number}
                          value={season.season_number}
                        >
                          {season.name || `Temporada ${season.season_number}`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      value={modalSeason}
                      onChange={(event) => {
                        setModalSeason(event.target.value);
                        setModalEpisode("1");
                      }}
                      aria-label="Selecionar temporada"
                    />
                  )}
                </label>
                <label className="modal__quick-field" title="Episodio">
                  <span>E</span>
                  {modalEpisodes.length ? (
                    <select
                      value={modalEpisode}
                      onChange={(event) => setModalEpisode(event.target.value)}
                      aria-label="Selecionar episodio"
                    >
                      {modalEpisodes.map((episode) => (
                        <option
                          key={episode.id || episode.episode_number}
                          value={episode.episode_number}
                        >
                          E{episode.episode_number}
                          {episode.name ? ` · ${episode.name}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      value={modalEpisode}
                      onChange={(event) => setModalEpisode(event.target.value)}
                      aria-label="Selecionar episodio"
                    />
                  )}
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
