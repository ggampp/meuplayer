import { createRoot } from 'react-dom/client';

function Home() {
  return <main className="module-home">
    <header className="module-home__intro">
      <p className="module-kicker">SEU TEMPO. SUA ESCOLHA.</p>
      <h1>O que vamos<br /><span>assistir hoje?</span></h1>
      <p>Uma boa história ou o que está acontecendo agora.<br />Escolha sua experiência.</p>
    </header>
    <div className="module-choices">
      <a className="module-choice module-choice--vod" href="/vod">
        <div className="module-choice__art" aria-hidden="true"><span className="cinema-frame">▶</span><span className="cinema-line" /></div>
        <div className="module-choice__content"><span className="module-kicker">01 / SOB DEMANDA</span><h2>Filmes e séries</h2><p>Histórias para todos os momentos.<br />Filmes, séries, animes e doramas.</p><span className="module-choice__action">Explorar VOD <span aria-hidden="true">↗</span></span></div>
      </a>
      <a className="module-choice module-choice--tv" href="/tv">
        <div className="module-choice__art" aria-hidden="true"><div className="signal-bars">{[1,2,3,4,5,6,7,8,9].map(n => <i key={n} />)}</div></div>
        <div className="module-choice__content"><span className="module-kicker">02 / AO VIVO</span><h2>TV ao vivo</h2><p>Conecte-se ao que acontece agora.<br />Seus canais e favoritos em um só lugar.</p><span className="module-choice__action">Abrir TV <span aria-hidden="true">↗</span></span></div>
      </a>
    </div>
    <footer className="module-home__footer"><span>MEUPLAYER / WEB</span><span>Você pode trocar de módulo a qualquer momento.</span></footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Home />);
