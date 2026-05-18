/* js/modules/welcome.js */
// Welcome home screen logic only (UI).
// Fix:
// - Non forza più la Welcome ad ogni refresh.
// - Salva l'ultima modalità (solo nella sessione/tab) e la ripristina dopo refresh.
// - La Welcome si apre solo quando:
//    a) l'utente clicca sul logo in sidebar (Home)
//    b) la tab viene chiusa e riaperta (sessionStorage reset)
// - Drawer Aiuto: CHIPS + FAQ + ricerca (i bottoni Teams/Mail restano in index.html)

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

  // session keys (si azzerano chiudendo la tab)
  const LAST_MODE_KEY = 'abitare_tools_last_mode';
  const FORCE_WELCOME_KEY = 'abitare_tools_force_welcome';

  function setActionbarVar(){
    const ab = document.getElementById('ActionBar');
    if (!ab) return;
    const h = Math.max(56, ab.getBoundingClientRect().height || 0);
    document.documentElement.style.setProperty('--welcome-actionbar-h', h + 'px');
  }

  function enterWelcome(){
    document.body.classList.add('welcome-home');
    // URL pulita (senza query)
    try { history.replaceState(null, '', window.location.pathname); } catch {}
    setActionbarVar();
  }

  function leaveWelcome(){
    document.body.classList.remove('welcome-home');
  }

  function isAllowedMenuItem(li){
    if (!li) return false;
    if (li.classList && li.classList.contains('hidden')) return false;
    const style = window.getComputedStyle(li);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    return true;
  }

  function buildCards(){
    const wrap = document.getElementById('WelcomeCards');
    if (!wrap) return;
    const items = $$('#SideMenu li[data-mode]').filter(isAllowedMenuItem);
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
        // salva la modalità scelta
        try { sessionStorage.setItem(LAST_MODE_KEY, mode); } catch {}
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

  // Drawer Aiuto: chips + FAQ
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
    { q: 'Watermark: come funziona?', a: 'Vai su Watermark, seleziona il preset e clicca Esporta.' },
    { q: 'BV 3D: non vedo l’anteprima', a: 'Compila i campi e clicca Genera anteprima. Il mockup BV 3D si aggiorna automaticamente.' },
    { q: 'QR: come genero un QR con UTM?', a: 'Vai su Genera QR Code, compila i campi UTM e scarica il QR.' },
    { q: 'Immagini: preset Sito Abitare Co.', a: 'Orizzontali 1920×1080; verticali/quadrate H=1080 con larghezza proporzionale (no tagli).' },
    { q: 'Personalizzato: quando compare il crop manuale?', a: 'Il crop manuale è disponibile solo in “Personalizzato” quando carichi una sola immagine.' },
    { q: 'Font PPT: come li scarico?', a: 'Vai su Template PPT → Font ufficiali → Scarica font ufficiali.' }
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
    if (!term) return renderFaq(FAQ);
    renderFaq(FAQ.filter(x => (x.q + ' ' + x.a).toLowerCase().includes(term)));
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
      // Forza Welcome solo su click logo
      try { sessionStorage.setItem(FORCE_WELCOME_KEY, '1'); } catch {}
      // reload pulito
      window.location.href = window.location.origin + window.location.pathname;
    });
  }

  function observeMenuForRoleChanges(){
    const menu = document.getElementById('SideMenu');
    if (!menu || !window.MutationObserver) return;

    let t = 0;
    const debounce = () => {
      window.clearTimeout(t);
      t = window.setTimeout(buildCards, 50);
    };

    const obs = new MutationObserver(debounce);
    obs.observe(menu, { attributes:true, childList:true, subtree:true });

    window.setTimeout(buildCards, 200);
    window.setTimeout(buildCards, 600);
  }

  // ---- Last mode persistence (session only) ----
  function modeIsAllowed(mode){
    const li = document.querySelector(`#SideMenu li[data-mode="${mode}"]`);
    return isAllowedMenuItem(li);
  }

  function hookSelectMode(){
    if (!window.selectMode || window.selectMode.__welcomeHooked) return;

    const orig = window.selectMode;
    const wrapped = function(mode){
      // memorizza l'ultima modalità NON welcome
      try {
        if (mode && mode !== 'welcome') sessionStorage.setItem(LAST_MODE_KEY, String(mode));
      } catch {}

      const res = orig.apply(this, arguments);

      // gestisci classi Welcome
      try {
        if (mode === 'welcome'){
          enterWelcome();
          buildCards();
        } else {
          leaveWelcome();
        }
      } catch {}

      return res;
    };

    wrapped.__welcomeHooked = true;
    wrapped.__welcomeOrig = orig;
    window.selectMode = wrapped;
  }

  function restoreLastMode(){
    // se l'utente ha cliccato il logo -> forza welcome
    let force = false;
    try {
      force = sessionStorage.getItem(FORCE_WELCOME_KEY) === '1';
      if (force) sessionStorage.removeItem(FORCE_WELCOME_KEY);
    } catch {}

    if (force){
      try { window.selectMode && window.selectMode('welcome'); } catch {}
      return;
    }

    // se c'è una last mode valida in sessione, resta lì
    let last = '';
    try { last = sessionStorage.getItem(LAST_MODE_KEY) || ''; } catch {}

    if (last && last !== 'welcome' && modeIsAllowed(last)){
      try { window.selectMode && window.selectMode(last); } catch {}
      return;
    }

    // fallback: welcome (prima apertura o ruolo cambiato)
    try { window.selectMode && window.selectMode('welcome'); } catch {}
  }

  function init(){
    hookSelectMode();
    bindHelp();
    bindSidebarLogo();
    observeMenuForRoleChanges();

    // store last mode on sidebar click (extra safety)
    $$('#SideMenu li[data-mode]').forEach(li => {
      li.addEventListener('click', () => {
        const m = li.dataset.mode;
        if (m && m !== 'welcome') { try { sessionStorage.setItem(LAST_MODE_KEY, m); } catch {} }
      });
    });

    // Se il core non chiama selectMode all'avvio, ripristina noi dopo che la UI è pronta.
    // Aspettiamo un attimo per lasciare applicare i guard/ruoli.
    setTimeout(() => {
      // se currentMode è già impostata e non è welcome, non tocchiamo nulla
      const cur = (window.currentMode || '').toString();
      if (cur && cur !== 'welcome'){
        leaveWelcome();
        return;
      }
      restoreLastMode();
    }, 250);

    window.addEventListener('resize', () => {
      if (document.body.classList.contains('welcome-home')) setActionbarVar();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
