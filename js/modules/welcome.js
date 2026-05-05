/* js/modules/welcome.js */

(function(){
  'use strict';

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

  const cardWrap = document.getElementById('WelcomeCards');
  const btnHelp = document.getElementById('WelcomeHelpBtn');
  const overlay = document.getElementById('WelcomeHelpOverlay');
  const drawer = document.getElementById('WelcomeHelpDrawer');
  const btnClose = document.getElementById('WelcomeHelpClose');
  const q = document.getElementById('WelcomeHelpQuery');
  const chipsWrap = document.getElementById('WelcomeHelpChips');
  const faqWrap = document.getElementById('WelcomeHelpFaq');

  if (!cardWrap) return;

  // Build cards from sidebar menu (no duplicazioni)
  function buildCards(){
    const items = $$('#SideMenu li[data-mode]');
    const desc = {
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
          <p>${desc[mode] || 'Apri questa modalità.'}</p>
        </div>
      `;

      const go = () => {
        // Simula click sul menu (non tocchiamo le modalità)
        try { li.click(); } catch {}
      };

      card.addEventListener('click', go);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });

      cardWrap.appendChild(card);
    });
  }

  // Help drawer (solo UI/FAQ)
  const chips = ['Immagini','BV 3D','Export','Font PPT','QR','Watermark'];
  const faq = [
    { q: 'Come esporto le immagini per il sito?', a: 'Vai su Immagini, inserisci Nome file ITA/ENG, seleziona formato e clicca “Esporta ora”.' },
    { q: 'Perché alcune immagini verticali non vengono tagliate?', a: 'Nel preset “Sito Abitare Co.” le verticali/quadrate mantengono altezza 1080 e larghezza proporzionale.' },
    { q: 'Quando compare il crop manuale?', a: 'Il crop manuale è disponibile solo in “Personalizzato” quando carichi una sola immagine.' },
    { q: 'Come scarico i font PPT?', a: 'Vai su Template PPT → Font ufficiali → Scarica font ufficiali.' },
    { q: 'Biglietto da visita: come vedo anteprima 3D?', a: 'Compila i campi, clicca Genera anteprima: il mockup 3D si aggiorna automaticamente.' },
    { q: 'Non vedo gli aggiornamenti dopo un commit', a: 'Esegui hard refresh (Ctrl+F5 / Cmd+Shift+R) o disattiva cache dal tab Network.' }
  ];

  function renderChips(){
    if (!chipsWrap) return;
    chipsWrap.innerHTML = '';
    chips.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'welcome-chip';
      b.textContent = t;
      b.addEventListener('click', () => {
        if (q){ q.value = t; filterFaq(); q.focus(); }
      });
      chipsWrap.appendChild(b);
    });
  }

  function renderFaq(list){
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

  function filterFaq(){
    const term = (q?.value || '').trim().toLowerCase();
    if (!term){ renderFaq(faq); return; }
    const filtered = faq.filter(x => (x.q + ' ' + x.a).toLowerCase().includes(term));
    renderFaq(filtered);
  }

  function openHelp(){
    overlay?.classList.remove('hidden');
    drawer?.classList.remove('hidden');
    overlay?.setAttribute('aria-hidden','false');
    drawer?.setAttribute('aria-hidden','false');
    setTimeout(() => q?.focus(), 0);
  }

  function closeHelp(){
    overlay?.classList.add('hidden');
    drawer?.classList.add('hidden');
    overlay?.setAttribute('aria-hidden','true');
    drawer?.setAttribute('aria-hidden','true');
  }

  btnHelp?.addEventListener('click', openHelp);
  btnClose?.addEventListener('click', closeHelp);
  overlay?.addEventListener('click', closeHelp);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer && !drawer.classList.contains('hidden')) closeHelp();
  });
  q?.addEventListener('input', filterFaq);

  // Init
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      buildCards();
      renderChips();
      renderFaq(faq);
    });
  } else {
    buildCards();
    renderChips();
    renderFaq(faq);
  }

})();
