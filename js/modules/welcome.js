/* js/modules/welcome.js */
// Welcome home screen logic only. Does NOT modify tool modules.

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

  function setActionbarVar(){
    const ab = document.getElementById('ActionBar');
    if (!ab) return;
    const h = Math.max(56, ab.getBoundingClientRect().height || 0);
    document.documentElement.style.setProperty('--welcome-actionbar-h', h + 'px');
  }

  function enterWelcome(){
    document.body.classList.add('welcome-home');
    // remove any query/hash to keep url clean
    try { history.replaceState(null, '', window.location.pathname); } catch {}
    setActionbarVar();
  }

  function leaveWelcome(){
    document.body.classList.remove('welcome-home');
  }

  function isAllowedMenuItem(li){
    if (!li) return false;
    if (li.classList?.contains('hidden')) return false;
    const style = window.getComputedStyle(li);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
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

  // Help drawer: only open/close (content is in index.html)
  function bindHelp(){
    const btnHelp = document.getElementById('WelcomeHelpBtn');
    const btnClose = document.getElementById('WelcomeHelpClose');
    const overlay = document.getElementById('WelcomeHelpOverlay');
    const drawer = document.getElementById('WelcomeHelpDrawer');

    if (!btnHelp || !overlay || !drawer) return;

    const open = () => {
      overlay.classList.remove('hidden');
      drawer.classList.remove('hidden');
      overlay.setAttribute('aria-hidden','false');
      drawer.setAttribute('aria-hidden','false');
      setTimeout(() => document.getElementById('WelcomeHelpQuery')?.focus(), 0);
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
  }

  function bindSidebarLogo(){
    const logo = document.getElementById('SidebarLogo');
    if (!logo) return;
    logo.style.cursor = 'pointer';
    logo.addEventListener('click', () => {
      // Reload clean base URL
      window.location.href = window.location.origin + window.location.pathname;
    });
  }

  function init(){
    enterWelcome();
    buildCards();
    bindHelp();
    bindSidebarLogo();

    // Clicking any sidebar item exits welcome
    $$('#SideMenu li[data-mode]').forEach(li => {
      li.addEventListener('click', () => leaveWelcome());
    });

    window.addEventListener('resize', () => {
      if (document.body.classList.contains('welcome-home')) setActionbarVar();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
