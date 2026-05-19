(function () {
  const LINKS = [
    { label: 'Filmes', path: '/filme' },
    { label: 'Séries', path: '/serie' },
    { label: 'Animes', path: '/anime' },
    { label: 'Canais', path: '/canais' },
  ];

  const style = document.createElement('style');
  style.textContent = `
    .app-nav {
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 32px;
      height: 52px;
      background: rgba(11, 11, 18, 0.97);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(8px);
      flex-shrink: 0;
    }
    .app-nav__logo {
      font-size: 1.05rem;
      font-weight: 700;
      color: #e50914;
      text-decoration: none;
      letter-spacing: 0.04em;
      margin-right: 16px;
    }
    .app-nav__link {
      color: #b0b3c2;
      text-decoration: none;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 0.88rem;
      transition: color 0.15s, background 0.15s;
    }
    .app-nav__link:hover {
      color: #f5f5f5;
      background: rgba(255, 255, 255, 0.07);
    }
    .app-nav__link--active {
      color: #f5f5f5;
      background: rgba(255, 255, 255, 0.1);
    }
  `;
  document.head.appendChild(style);

  const currentPath = window.location.pathname;

  function isActive(linkPath) {
    if (linkPath === '/') return currentPath === '/';
    return currentPath === linkPath || currentPath.startsWith(linkPath + '/');
  }

  const nav = document.createElement('nav');
  nav.className = 'app-nav';

  const logo = document.createElement('a');
  logo.className = 'app-nav__logo';
  logo.href = '/';
  logo.textContent = 'MeuPlayer';
  nav.appendChild(logo);

  LINKS.forEach(({ label, path: linkPath }) => {
    const a = document.createElement('a');
    a.className = 'app-nav__link' + (isActive(linkPath) ? ' app-nav__link--active' : '');
    a.href = linkPath;
    a.textContent = label;
    nav.appendChild(a);
  });

  function inject() {
    document.body.insertBefore(nav, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
