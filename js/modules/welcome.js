/* js/modules/welcome.js */
// Welcome (Photoshop light) + Help drawer (UI only)
// + UX: in Welcome nascondiamo la sidebar. Clic su una card => mostra sidebar e apre modalità.
// + Clic sul logo della sidebar => ritorna alla Welcome.
// NON modifica alcuna modalità: simula click sulla sidebar.

(function(){
  'use strict';

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

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

  function isVisible(el){
    if (!el) return false;
    // Non usare getComputedStyle qui: la sidebar in Welcome è compressa.
    if (el.classList?.contains('hidden')) return false;
    if (el.hasAttribute('hidden')) return false;
    if (el.style && el.style.display === 'none') return false;
    return true;
  }

  function enterWelcome(){
    document.body.classList.add('welcome-home');
  }

  function leaveWelcome(){
    document.body.classList.remove('welcome-home');
  }

  function buildCards(){
    const wrap = document.getElementById('WelcomeCards');
    if (!wrap) return;

    const items = $$('#SideMenu li[data-mode]').filter(isVisible);
    wrap.innerHTML = '';

    items.forEach(li => {
      const mode = li.dataset.mode;
      const icon = li.dataset.icon;
      const title = (li.querySelector('.txt')?.textContent || mode).trim();

      const card = document.createElement('div');
      card.className = 'welcome-card';
      card.setAttribute('role','button');
      card.setAttribute('tabindex','0');

      card.innerHTML = `
        <div class="welcome-icowrap"><img alt="" src="${icon}" /></div>
        <div>
          <h4>${title}</h4>
          <p>${DESC[mode] || 'Apri questa modalità.'}</p>
        </div>
      `;

      const go = () => {
        leaveWelcome();
        try { li.click(); } catch {}
      };

      card.addEventListener('click', go);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });

      wrap.appendChild(card);
    });
  }

  // Help drawer
  const CHIPS = [
    { label:'Immagini', value:'immagini' },
    { label:'Export', value:'export' },
    { label:'Watermark', value:'watermark' },
    { label:'BV 3D', value:'bv 3d' },
    { label:'QR', value:'qr' },
    { label:'Font PPT', value:'ppt' }
  ];

  const FAQ = [
    { q: 'Export: dove scarico lo ZIP?', a: 'Dopo “Esporta ora” il browser scarica un file ZIP. Se non parte, controlla blocchi popup/download.' },
    { q: 'Watermark: come funziona?', a: 'Vai su Watermark, carica (opzionale) un logo PNG e clicca Esporta.' },
    { q: 'BV 3D: non vedo l’anteprima', a: 'Compila i campi e clicca Genera anteprima. Il mockup BV 3D si aggiorna automaticamente.' },
    { q: 'QR: come genero un QR con UTM?', a: 'Vai su Genera QR Code, compila i campi UTM e scarica il QR.' },
    { q: 'Immagini: preset Sito Abitare Co.', a: 'Orizzontali 1920×1080; verticali/quadrate H=1080 con larghezza proporzionale (no tagli).' },
    { q: 'Personalizzato: quando compare il crop manuale?', a: 'Il crop manuale è disponibile solo in “Personalizzato” quando carichi una sola immagine.' },
    { q: 'Font PPT: come li scarico?', a: 'Vai su Template PPT → Font ufficiali → Scarica font ufficiali.' },
    { q: 'Non vedo gli aggiornamenti dopo un commit', a: 'Esegui hard refresh (Ctrl+F5 / Cmd+Shift+R) o disattiva cache dal tab Network.' }
  ];

  function renderChips(){
    const chipsWrap = document.getElementById('WelcomeHelpChips');
    const q = document.getElementById('WelcomeHelpQuery');
    if (!chipsWrap || !q) return;

    chipsWrap.innerHTML = '';
    CHIPS.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'welcome-chip';
      b.textContent = c.label;
      b.addEventListener('click', () => {
        q.value = c.value;
        q.dispatchEvent(new Event('input'));
        q.focus();
      });
      chipsWrap.appendChild(b);
    });
  }

  function renderFaq(list){
    const faqWrap = document.getElementById('WelcomeHelpFaq');
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
    const q = document.getElementById('WelcomeHelpQuery');
    const term = (q?.value || '').trim().toLowerCase();
    if (!term){ renderFaq(FAQ); return; }
    const filtered = FAQ.filter(x => (x.q + ' ' + x.a).toLowerCase().includes(term));
    renderFaq(filtered);
  }

  function bindHelp(){
    const btnHelp = document.getElementById('WelcomeHelpBtn');
    const btnClose = document.getElementById('WelcomeHelpClose');
    const overlay = document.getElementById('WelcomeHelpOverlay');
    const drawer = document.getElementById('WelcomeHelpDrawer');
    const q = document.getElementById('WelcomeHelpQuery');

    if (!btnHelp || !overlay || !drawer) return;

    const open = () => {
      overlay.classList.remove('hidden');
      drawer.classList.remove('hidden');
      overlay.setAttribute('aria-hidden','false');
      drawer.setAttribute('aria-hidden','false');
      setTimeout(() => q?.focus(), 0);
    };

    const close = () => {
      overlay.classList.add('hidden');
      drawer.classList.add('hidden');
      overlay.setAttribute('aria-hidden','true');
      drawer.setAttribute('aria-hidden','true');
    };

    btnHelp.addEventListener('click', open);
    btnClose?.addEventListener('click', close);
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !drawer.classList.contains('hidden')) close();
    });

    q?.addEventListener('input', filterFaq);
    renderChips();
    renderFaq(FAQ);
  }

  function bindSidebarLogo(){
    const logo = document.getElementById('SidebarLogo') || document.querySelector('.sidebar .logo');
    if (!logo) return;

    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => {
      // ritorno alla welcome: reload pulito (sicuro, non tocca modalità)
      const url = window.location.origin + window.location.pathname;
      window.location.href = url;
    });
  }

  function observeRoleChanges(){
    const menu = document.getElementById('SideMenu');
    if (!menu) return;
    const obs = new MutationObserver(() => buildCards());
    obs.observe(menu, { attributes:true, childList:true, subtree:true });
  }

  function init(){
    // appena entri in app, sei in Welcome
    enterWelcome();
    buildCards();
    bindHelp();
    bindSidebarLogo();
    observeRoleChanges();

    // Se l'utente clicca una voce del menu, esci dalla welcome
    $$('#SideMenu li[data-mode]').forEach(li => {
      li.addEventListener('click', () => leaveWelcome());
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
