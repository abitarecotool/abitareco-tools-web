/* js/modules/welcome.js */
// Welcome (Photoshop light) + Help drawer (UI only)
// FIX: card list coerente con sidebar (per ruolo) + drawer stabile + chip che filtrano davvero + bottone assistenza mail.

(function(){
  'use strict';

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

  const cardWrap = document.getElementById('WelcomeCards');
  if (!cardWrap) return;

  function isVisible(el){
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    if (el.classList?.contains('hidden')) return false;
    if (el.offsetParent === null && style.position !== 'fixed') return false;
    return true;
  }

  // Ensure help drawer DOM exists (fallback)
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

      // mailto support
      const to = 'billy.dolor@abitareco.it';
      const cc = 'mattia.nichettistanghellini@abitareco.it';
      const subject = encodeURIComponent('Assistenza · Abitare Co. Digital Content Tool');
      const body = encodeURIComponent('Ciao,

Ho bisogno di assistenza su: 

- Profilo: (Admin/Marketing/Tecnico)
- Modalità: 
- Dettagli: 

Grazie.');
      const mailto = `mailto:${to}?cc=${encodeURIComponent(cc)}&subject=${subject}&body=${body}`;

      drawer.innerHTML = `
        <div class="welcome-help-top">
          <button id="WelcomeHelpClose" type="button" class="welcome-help-close" aria-label="Chiudi">✕</button>
        </div>
        <div class="welcome-help-body">
          <h3 id="WelcomeHelpTitle" class="welcome-help-title">Serve una mano?</h3>
          <p class="welcome-help-sub">Risposte rapide e scorciatoie per usare il tool interno.</p>

          <div class="welcome-help-search">
            <input id="WelcomeHelpQuery" class="input" type="text" placeholder="Cerca (es. immagini, export, watermark, BV 3D)" />
          </div>

          <div class="welcome-help-chips" id="WelcomeHelpChips" aria-label="Suggerimenti rapidi"></div>
          <div id="WelcomeHelpFaq" class="welcome-help-faq" aria-label="FAQ"></div>

          <div class="welcome-help-actions">
            <a class="btn-outline" href="${mailto}">Contatta l’assistenza</a>
          </div>
          <div class="welcome-help-note">L’assistenza apre una mail precompilata.</div>
        </div>
      `;
      document.body.appendChild(drawer);
    }

    return { overlay, drawer };
  }

  // Card descriptions
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

  // Build cards ONLY from visible sidebar items (coerente con i ruoli)
  function buildCards(){
    const items = $$('#SideMenu li[data-mode]').filter(isVisible);
    cardWrap.innerHTML = '';

    items.forEach(li => {
      const mode = li.dataset.mode;
      const icon = li.dataset.icon;
      const title = (li.querySelector('.txt')?.textContent || mode).trim();

      const card = document.createElement('div');
      card.className = 'welcome-card';
      card.setAttribute('role','button');
      card.setAttribute('tabindex','0');
      card.dataset.mode = mode;

      card.innerHTML = `
        <div class="welcome-icowrap"><img alt="" src="${icon}" /></div>
        <div>
          <h4>${title}</h4>
          <p>${DESC[mode] || 'Apri questa modalità.'}</p>
        </div>
      `;

      const go = () => { try { li.click(); } catch {} };
      card.addEventListener('click', go);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });

      cardWrap.appendChild(card);
    });
  }

  // Help drawer content
  const chips = ['Immagini','Export','Watermark','BV 3D','QR','Font PPT'];
  const faq = [
    { q: 'Export: dove scarico lo ZIP?', a: 'Dopo “Esporta ora” il browser scarica un file ZIP. Se non parte, controlla blocchi popup/download.' },
    { q: 'Watermark: come funziona?', a: 'Vai su Watermark, carica (opzionale) un logo PNG e clicca Esporta. Keyword: watermark.' },
    { q: 'BV 3D: non vedo l’anteprima', a: 'Compila i campi e clicca Genera anteprima. Il mockup BV 3D si aggiorna automaticamente.' },
    { q: 'QR: come genero un QR con UTM?', a: 'Vai su Genera QR Code, compila i campi UTM e scarica il QR.' },
    { q: 'Immagini: preset Sito Abitare Co.', a: 'Orizzontali 1920×1080; verticali/quadrate H=1080 con larghezza proporzionale (no tagli).' },
    { q: 'Personalizzato: quando compare il crop manuale?', a: 'Il crop manuale è disponibile solo in “Personalizzato” quando carichi una sola immagine.' },
    { q: 'Font PPT: come li scarico?', a: 'Vai su Template PPT → Font ufficiali → Scarica font ufficiali.' },
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
        if (!q) return;
        // mapping per termini italiani
        const map = { 'BV 3D':'BV 3D', 'Export':'Export', 'Watermark':'Watermark', 'QR':'QR', 'Font PPT':'Font PPT', 'Immagini':'Immagini' };
        q.value = map[t] || t;
        q.dispatchEvent(new Event('input'));
        q.focus();
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

    // Bind once
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

  const init = () => {
    buildCards();
    mountHelp();

    // Rebuild cards after role change (dropdown)
    const userMenu = document.getElementById('UserMenu');
    userMenu?.addEventListener('click', () => setTimeout(buildCards, 80));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
