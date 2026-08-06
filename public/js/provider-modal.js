if(!window.MeuPlayerProviderModal){let c=function(){if(e)return;e=document.createElement("div"),e.className="mp-modal-backdrop",e.innerHTML=`
    <div class="mp-modal">
      <div class="mp-modal__header">
        <h3 class="mp-modal__title">Nova plataforma</h3>
        <button class="mp-modal__close" aria-label="Fechar">&times;</button>
      </div>
      <form id="mpProviderForm">
        <div class="mp-modal__form-group">
          <label class="mp-modal__label" for="mpProviderName">Nome da Plataforma / Canal *</label>
          <input type="text" id="mpProviderName" class="mp-modal__input" placeholder="Ex: Disney+, Globoplay, Youtube..." required />
        </div>
        <div class="mp-modal__form-group">
          <label class="mp-modal__label" for="mpProviderUrl">URL da Plataforma *</label>
          <input type="url" id="mpProviderUrl" class="mp-modal__input" placeholder="Ex: https://www.disneyplus.com" required />
        </div>
        <div class="mp-modal__form-group">
          <label class="mp-modal__label" for="mpProviderIcon">URL do Logo / Imagem</label>
          <input type="text" id="mpProviderIcon" class="mp-modal__input" placeholder="Cole a URL da imagem ou escolha abaixo..." />
          
          <div class="mp-modal__preset-logos">
            <button type="button" class="mp-modal__preset-btn" data-icon="/img/providers/max.svg">
              <img src="/img/providers/max.svg" alt="Max" /> Max
            </button>
            <button type="button" class="mp-modal__preset-btn" data-icon="/img/providers/netflix.svg">
              <img src="/img/providers/netflix.svg" alt="Netflix" /> Netflix
            </button>
            <button type="button" class="mp-modal__preset-btn" data-icon="/img/providers/recordplus.svg">
              <img src="/img/providers/recordplus.svg" alt="Record+" /> Record+
            </button>
            <button type="button" class="mp-modal__preset-btn" data-icon="/img/providers/primevideo.svg">
              <img src="/img/providers/primevideo.svg" alt="Prime" /> Prime
            </button>
            <button type="button" class="mp-modal__preset-btn" data-icon="/img/providers/default-provider.svg">
              <img src="/img/providers/default-provider.svg" alt="Default" /> Padrão
            </button>
          </div>
        </div>
        <div class="mp-modal__preview">
          <img id="mpPreviewImg" class="mp-modal__preview-img" src="/img/providers/default-provider.svg" alt="Preview" />
          <span id="mpPreviewText" class="mp-modal__preview-text">Pré-visualização do logo</span>
        </div>
        <div class="mp-modal__footer">
          <button type="button" class="mp-btn mp-btn--secondary mp-modal__cancel">Cancelar</button>
          <button type="submit" class="mp-btn mp-btn--primary">Salvar plataforma</button>
        </div>
      </form>
    </div>
  `,document.body.appendChild(e);const s=e.querySelector(".mp-modal__close"),u=e.querySelector(".mp-modal__cancel"),b=e.querySelector("#mpProviderForm"),i=e.querySelector("#mpProviderIcon"),f=e.querySelector("#mpPreviewImg"),g=e.querySelectorAll(".mp-modal__preset-btn");function p(){const r=i.value.trim();f.src=r||"/img/providers/default-provider.svg"}i.addEventListener("input",p),g.forEach(r=>{r.addEventListener("click",()=>{const d=r.getAttribute("data-icon");i.value=d,p()})}),s.addEventListener("click",a),u.addEventListener("click",a),e.addEventListener("click",r=>{r.target===e&&a()}),b.addEventListener("submit",async r=>{r.preventDefault();const d=e.querySelector("#mpProviderName").value.trim(),_=e.querySelector("#mpProviderUrl").value.trim();let n=i.value.trim();n||(n="/img/providers/default-provider.svg");try{const l=await fetch("/api/providers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:d,url:_,icon:n})});if(l.ok){const o=await l.json();window.dispatchEvent(new CustomEvent("meuplayer:providers-changed",{detail:{provider:o}})),a();const t=new URLSearchParams;t.set("url",o.url||""),t.set("name",o.name||""),o.icon&&t.set("icon",o.icon),o.id&&t.set("providerId",o.id),window.location.href="/player?"+t.toString()}else alert("Erro ao salvar provedor.")}catch(l){console.error("Erro ao salvar provedor:",l),alert("Erro de conexão ao salvar provedor.")}})},v=function(){c(),e.querySelector("#mpProviderForm").reset(),e.querySelector("#mpPreviewImg").src="/img/providers/default-provider.svg",e.classList.add("active"),setTimeout(()=>{e.querySelector("#mpProviderName").focus()},100)},a=function(){e&&e.classList.remove("active")};const m=document.createElement("style");m.textContent=`
  .mp-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(10, 10, 18, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-md, 1.5rem);
    opacity: 0;
    visibility: hidden;
    transition: opacity 220ms ease, visibility 220ms ease;
  }
  .mp-modal-backdrop.active {
    opacity: 1;
    visibility: visible;
  }
  .mp-modal {
    background: oklch(20% 0.02 250);
    border: 1px solid var(--color-rule, oklch(28% 0.015 250));
    border-radius: var(--radius-card, 16px);
    width: 100%;
    max-width: 520px;
    padding: var(--space-lg, 2rem);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    transform: translateY(20px) scale(0.96);
    transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
    color: var(--color-ink, #f1f5f9);
    font-family: var(--font-body, system-ui);
  }
  .mp-modal-backdrop.active .mp-modal {
    transform: translateY(0) scale(1);
  }
  .mp-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
  }
  .mp-modal__title {
    font-family: var(--font-display, Georgia);
    font-size: 1.35rem;
    font-weight: 600;
    color: var(--color-ink, #f8fafc);
    margin: 0;
  }
  .mp-modal__close {
    background: transparent;
    border: none;
    color: var(--color-ink-3, #94a3b8);
    font-size: 1.5rem;
    cursor: pointer;
    line-height: 1;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    transition: color 150ms ease, background 150ms ease;
  }
  .mp-modal__close:hover {
    color: var(--color-ink, #ffffff);
    background: rgba(255, 255, 255, 0.1);
  }
  .mp-modal__form-group {
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .mp-modal__label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-ink-2, #cbd5e1);
  }
  .mp-modal__input {
    background: oklch(16% 0.02 250);
    border: 1px solid var(--color-rule, oklch(28% 0.015 250));
    border-radius: 8px;
    padding: 0.65rem 0.85rem;
    color: var(--color-ink, #ffffff);
    font-size: 0.9rem;
    font-family: inherit;
    outline: none;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }
  .mp-modal__input:focus {
    border-color: var(--color-accent, oklch(78% 0.15 65));
    box-shadow: 0 0 0 3px oklch(78% 0.15 65 / 0.2);
  }
  .mp-modal__preset-logos {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.35rem;
  }
  .mp-modal__preset-btn {
    background: oklch(16% 0.02 250);
    border: 1px solid var(--color-rule, oklch(28% 0.015 250));
    border-radius: 6px;
    padding: 0.3rem 0.6rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    height: 32px;
    transition: all 150ms ease;
  }
  .mp-modal__preset-btn:hover {
    border-color: var(--color-accent, oklch(78% 0.15 65));
    background: rgba(255, 255, 255, 0.05);
  }
  .mp-modal__preset-btn img {
    height: 18px;
    object-fit: contain;
  }
  .mp-modal__preview {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: oklch(16% 0.02 250 / 0.6);
    padding: 0.75rem;
    border-radius: 10px;
    border: 1px dashed var(--color-rule, oklch(28% 0.015 250));
    margin-top: 0.5rem;
  }
  .mp-modal__preview-img {
    height: 34px;
    width: 70px;
    object-fit: contain;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 6px;
    padding: 2px;
  }
  .mp-modal__preview-text {
    font-size: 0.8rem;
    color: var(--color-ink-3, #94a3b8);
  }
  .mp-modal__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }
  .mp-btn {
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.6rem 1.2rem;
    border-radius: 999px;
    cursor: pointer;
    border: none;
    transition: all 150ms ease;
  }
  .mp-btn--secondary {
    background: transparent;
    color: var(--color-ink-2, #cbd5e1);
    border: 1px solid var(--color-rule, oklch(28% 0.015 250));
  }
  .mp-btn--secondary:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-ink, #ffffff);
  }
  .mp-btn--primary {
    background: var(--color-accent, oklch(78% 0.15 65));
    color: var(--color-accent-ink, #000000);
  }
  .mp-btn--primary:hover {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px oklch(78% 0.15 65 / 0.3);
  }
`,document.head.appendChild(m);let e=null;window.MeuPlayerProviderModal={open:v,close:a}}
//# sourceMappingURL=provider-modal.js.map
