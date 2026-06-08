(function () {
  const FOCUSABLE_SELECTOR = '.focusable, button, a, select, input, textarea, [tabindex]';

  function getCenter(rect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function getFocusableElements() {
    const list = Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR));
    return list.filter(el => {
      // Ignora elementos desativados, invisíveis ou com tabindex = -1
      if (el.disabled) return false;
      if (el.getAttribute('tabindex') === '-1') return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      // Garante que não esteja escondido por display:none nas proximidades
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return true;
    });
  }

  function navigate(direction) {
    const active = document.activeElement;
    const candidates = getFocusableElements();
    if (candidates.length === 0) return;

    // Se nada estiver focado, ou o foco estiver no body, foca no primeiro elemento válido
    if (!active || active === document.body || !candidates.includes(active)) {
      candidates[0].focus();
      return;
    }

    const currentRect = active.getBoundingClientRect();
    const currentCenter = getCenter(currentRect);

    let bestCandidate = null;
    let minScore = Infinity;

    candidates.forEach(cand => {
      if (cand === active) return;

      const candRect = cand.getBoundingClientRect();
      const candCenter = getCenter(candRect);

      const dx = candCenter.x - currentCenter.x;
      const dy = candCenter.y - currentCenter.y;

      let isMatch = false;
      let score = 0;

      // Penalização de desvio ortogonal (multiplicador para manter foco na mesma linha/coluna)
      const ORTHOGONAL_WEIGHT = 4;

      switch (direction) {
        case 'left':
          if (candCenter.x < currentCenter.x - 2) {
            isMatch = true;
            score = Math.abs(dx) + Math.abs(dy) * ORTHOGONAL_WEIGHT;
          }
          break;
        case 'right':
          if (candCenter.x > currentCenter.x + 2) {
            isMatch = true;
            score = Math.abs(dx) + Math.abs(dy) * ORTHOGONAL_WEIGHT;
          }
          break;
        case 'up':
          if (candCenter.y < currentCenter.y - 2) {
            isMatch = true;
            score = Math.abs(dy) + Math.abs(dx) * ORTHOGONAL_WEIGHT;
          }
          break;
        case 'down':
          if (candCenter.y > currentCenter.y + 2) {
            isMatch = true;
            score = Math.abs(dy) + Math.abs(dx) * ORTHOGONAL_WEIGHT;
          }
          break;
      }

      if (isMatch && score < minScore) {
        minScore = score;
        bestCandidate = cand;
      }
    });

    if (bestCandidate) {
      bestCandidate.focus();
      // Scroll suave para garantir visibilidade do elemento focado
      bestCandidate.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }

  window.addEventListener('keydown', function (e) {
    // Apenas intercepta se não estiver digitando em um input
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' && e.target.type === 'text') {
      if (e.key === 'Enter') {
        e.target.blur();
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        navigate('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigate('right');
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigate('up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        navigate('down');
        break;
      case 'Enter':
        // Ação de clique programático para navegadores de TV
        if (document.activeElement && document.activeElement !== document.body) {
          // Evita dupla ativação se o elemento já responde nativamente ao Enter (ex: <button>)
          const isNativeClick = ['button', 'a', 'input', 'select'].includes(document.activeElement.tagName.toLowerCase());
          if (!isNativeClick) {
            e.preventDefault();
            document.activeElement.click();
          }
        }
        break;
      case 'Backspace':
      case 'Escape':
        // Volta se puder, ou foca em um botão de voltar na tela ativa
        const backBtn = document.querySelector('.detail__back, .modal__close, .app-nav__logo');
        if (backBtn && document.activeElement !== backBtn) {
          e.preventDefault();
          backBtn.focus();
        }
        break;
    }
  });

  // Foca no primeiro elemento ao carregar a página
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const candidates = getFocusableElements();
      if (candidates.length > 0) {
        candidates[0].focus();
      }
    }, 500);
  });
})();
