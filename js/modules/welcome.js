/* js/modules/welcome.js */
// Welcome (Photoshop light) + Help drawer (UI only)
// + Role-aware cards: mostra solo le modalità disponibili; quelle non disponibili vengono "disabilitate" (opacità bassa)

(function(){
  'use strict';

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

  const cardWrap = document.getElementById('WelcomeCards');
  if (!cardWrap) return;

  // Ensure help drawer DOM exists even if index.html was cached/partial
  function ensureHelpDom(){
    let overlay = document.getElementById('WelcomeHelpOverlay');
    let drawer = document.getElementById('WelcomeHelpDrawer');

    if (!overlay){
      overlay = document.createElement('div');
      overlay.id = 'WelcomeHelpOverlay';
      overlay.className = 'welcome-help-overlay hidden';
      overlay.setAttribute('aria-hidden','true');
      document.body.appendChild(overlay);
    }

    if (!drawer){
      drawer = document.createElement('aside');
      drawer.id = 'WelcomeHelpDrawer';
      drawer.className = 'welcome-help-drawer hidden';
      drawer.setAttribute('role','dialog');
      drawer.setAttribute('aria-modal','true');
      drawer.setAttribute('aria-labelledby','WelcomeHelpTitle');
      drawer.setAttribute('aria-hidden','true');
      drawer.innerHTML = `
        <div class="welcome-help-top">
          <button id="WelcomeHelpClose" type="button" class="welcome-help-close" aria-label="Chiudi">✕</button>
        </div>
        <div class="welcome-help-body">
          <h3 id="WelcomeHelpTitle" class="welcome-help-title">Serve una mano?</h3>
          <p class="welcome-help-sub">Risposte rapide e scorciatoie per usare il tool interno.</p>

          <div class="welcome-help-search">
            <input id="WelcomeHelpQuery" class="input" type="text" placeholder="Cerca (es. immagini, BV, export, font)" />
          </div>

          <div class="welcome-help-chips" id="WelcomeHelpChips" aria-label="Suggerimenti rapidi"></div>
          <div id="WelcomeHelpFaq" class="welcome-help-faq" aria-label="FAQ"></div>

          <div class="welcome-help-note">Nota: questo pannello è informativo (non è un chatbot). Se serve, contatta la Creative Unit.</div>
        </div>
      `;
      document.body.appendChild(drawer);
    }

    return { overlay, drawer };
  }

  // Role-aware: elenco completo modalità (così possiamo anche mostrare quelle non disponibili)
  const MODES = [
    { mode:'images',      title:'Immagini',          icon:'./assets/icons/icon-sito.png' },
    { mode:'digitaltool', title:'DigitalTool',       icon:'./assets/icons/icon-digital.png' },
    { mode:'pdf2jpg',     title:'PDF → JPG',         icon:'./assets/icons/icon-pdf.png' },
    { mode:'rename',      title:'Rename',            icon:'./assets/icons/icon-rename.png' },
    { mode:'video',       title:'Video Slideshow',   icon:'./assets/icons/icon-video.png' },
    { mode:'watermark',   title:'Watermark',         icon:'./assets/icons/icon-watermark.png' },
    { mode:'bv',          title:'Biglietto da visita', icon:'./assets/icons/icon-bv.png' },
    { mode:'qr',          title:'Genera QR Code',    icon:'./assets/icons/icon-qr.png' },
    { mode:'iubenda',     title:'Iubenda',           icon:'./assets/icons/icon-iubenda.png' },
    { mode:'ppt',         title:'Template PPT',      icon:'./assets/icons/icon-ppt.png' }
  ];

  const DESC = {
    images: 'Ottimizza per sito e share, naming e export.',
    digitaltool: 'Immagini pronte per utilizzo digitale.',
    pdf2jpg: 'Converti PDF in immagini in pochi click.',
    rename: 'Rinomina file e cartelle in batch.',
    video: 'Crea video da cartelle immagini.',
    watermark: 'Applica watermark in modo rapido.',
    bv: 'Genera BV con anteprima 3D.',
    qr: 'Crea QR con parametri UTM.',
    iubenda: 'Genera snippet pulito e copiabile.',
    ppt: 'Template e font ufficiali.'
  };

  // Determina se una voce menu è disponibile (presente e visibile)
  function isMenuItemAvailable(li){
    if (!li) return false;
    // se viene nascosto via classi o display:none
    const style = window.getComputedStyle(li);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    // offsetParent null se display none (alcuni casi)
    if (li.offsetParent === null && style.position !== 'fixed') return false;
    // se esiste una classe hidden usata nel progetto
    if (li.classList && li.classList.contains('hidden')) return false;
    return true;
  }

  function buildCards(){
    cardWrap.innerHTML = '';

    MODES.forEach(def => {
      const li = document.querySelector(`#SideMenu li[data-mode="${def.mode}"]`);

      // Preferisci title/icon dal menu se presenti (così restano sincronizzati)
      const menuTitle = li?.querySelector('.txt')?.textContent?.trim();
      const menuIcon = li?.dataset?.icon;

      const title = menuTitle || def.title;
      const icon = menuIcon || def.icon;
      const available = isMenuItemAvailable(li);

      const card = document.createElement('div');
      card.className = 'welcome-card' + (available ? '' : ' disabled');
      card.setAttribute('role','button');
      card.setAttribute('tabindex', available ? '0' : '-1');
      card.dataset.mode = def.mode;

      card.innerHTML = `
        <div class="welcome-icowrap"><img alt="" src="${icon}" /></div>
        <div>
          <h4>${title}</h4>
          <p>${DESC[def.mode] || 'Apri questa modalità.'}</p>
        </div>
      `;

      if (available){
        const go = () => { try { li.click(); } catch {} };
        card.addEventListener('click', go);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
        });
      } else {
        // disabilitata: feedback leggero
        card.title = 'Non disponibile per questo profilo.';
      }

      cardWrap.appendChild(card);
    });
  }

  // Help content
  const chips = ['Immagini','BV 3D','Export','Font PPT','QR','Watermark'];
  const faq = [
    { q: 'Come esporto le immagini per il sito?', a: 'Vai su Immagini, inserisci Nome file ITA/ENG, seleziona formato e clicca “Esporta ora”.' },
    { q: 'Perché alcune immagini verticali non vengono tagliate?', a: 'Nel preset “Sito Abitare Co.” le verticali/quadrate mantengono altezza 1080 e larghezza proporzionale.' },
    { q: 'Quando compare il crop manuale?', a: 'Il crop manuale è disponibile solo in “Personalizzato” quando carichi una sola immagine.' },
    { q: 'Come scarico i font PPT?', a: 'Vai su Template PPT → Font ufficiali → Scarica font ufficiali.' },
    { q: 'Biglietto da visita: come vedo anteprima 3D?', a: 'Compila i campi, clicca Genera anteprima: il mockup 3D si aggiorna automaticamente.' },
    { q: 'Non vedo gli aggiornamenti dopo un commit', a: 'Esegui hard refresh (Ctrl+F5 / Cmd+Shift+R) o disattiva cache dal tab Network.' }
  ];

  function renderChips(chipsWrap, q){
    if (!chipsWrap) return;
    chipsWrap.innerHTML = '';
    chips.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'welcome-chip';
      b.textContent = t;
      b.addEventListener('click', () => {
        if (q){ q.value = t; q.dispatchEvent(new Event('input')); q.focus(); }
      });
      chipsWrap.appendChild(b);
    });
  }

  function renderFaq(faqWrap, list){
    if (!faqWrap) return;
    faqWrap.innerHTML = '';
    (list || []).forEach(item => {
      const box = document.createElement('div');
      box.className = 'welcome-faq-item';
      box.innerHTML = `
        <p class="welcome-faq-q">${item.q}</p>
        <p class="welcome-faq-a">${item.a}</p>
      `;
      faqWrap.appendChild(box);
    });
  }

  function mountHelp(){
    const { overlay, drawer } = ensureHelpDom();
    const btnHelp = document.getElementById('WelcomeHelpBtn');
    const btnClose = document.getElementById('WelcomeHelpClose');
    const q = document.getElementById('WelcomeHelpQuery');
    const chipsWrap = document.getElementById('WelcomeHelpChips');
    const faqWrap = document.getElementById('WelcomeHelpFaq');

    const filterFaq = () => {
      const term = (q?.value || '').trim().toLowerCase();
      if (!term){ renderFaq(faqWrap, faq); return; }
      const filtered = faq.filter(x => (x.q + ' ' + x.a).toLowerCase().includes(term));
      renderFaq(faqWrap, filtered);
    };

    const openHelp = () => {
      overlay.classList.remove('hidden');
      drawer.classList.remove('hidden');
      overlay.setAttribute('aria-hidden','false');
      drawer.setAttribute('aria-hidden','false');
      setTimeout(() => q?.focus(), 0);
    };

    const closeHelp = () => {
      overlay.classList.add('hidden');
      drawer.classList.add('hidden');
      overlay.setAttribute('aria-hidden','true');
      drawer.setAttribute('aria-hidden','true');
    };

    btnHelp?.addEventListener('click', openHelp);
    btnClose?.addEventListener('click', closeHelp);
    overlay.addEventListener('click', closeHelp);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !drawer.classList.contains('hidden')) closeHelp();
    });

    q?.addEventListener('input', filterFaq);
    renderChips(chipsWrap, q);
    renderFaq(faqWrap, faq);
  }

  // Init
  const init = () => {
    buildCards();
    mountHelp();

    // Se l'utente cambia profilo, la sidebar viene aggiornata: ricostruisci le card
    // (hook leggero, non invasivo)
    const userMenu = document.getElementById('UserMenu');
    userMenu?.addEventListener('click', () => setTimeout(buildCards, 50));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
