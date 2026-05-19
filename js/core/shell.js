// js/core/shell.js
(function(){
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const showEl = (el) => el && el.classList.remove('hidden');
  const hideEl = (el) => el && el.classList.add('hidden');

  const SideMenu = $('#SideMenu');
  const BtnProcedi = $('#BtnProcedi');
  const DEFAULT_PRIMARY_LABEL = 'Esporta ora';
  const LAST_MODE_KEY = 'abitare_tools_last_mode';
  const FORCE_WELCOME_KEY = 'abitare_tools_force_welcome';

  function setPrimaryActionLabel(txt){
    if (BtnProcedi) BtnProcedi.textContent = txt || DEFAULT_PRIMARY_LABEL;
  }

  const MODE_CARDS = {
    welcome: ['WelcomeCard'],
    images: ['SlugCard','FormatCard','UploadCard'],
    digitaltool: ['DTCard','UploadCard'],
    pdf2jpg: ['UploadCard'],
    rename: ['RenameCard'],
    video: ['VideoCard'],
    watermark: ['WatermarkCard','UploadCard'],
    bv: ['BusinessCardCard'],
    qr: ['QrCard'],
    iubenda: ['IubendaCard'],
    ppt: ['PptFontsCard','PptCorporateCard','PptAdvisorCard','PptMarketingCard']
  };

  function initSidebarIcons(){
    $$('#SideMenu li').forEach(li => {
      const img = li.querySelector('.mi img');
      if (img && li.dataset.icon) img.src = li.dataset.icon;
    });
  }

  function activateMenuVisual(mode){
    $$('#SideMenu li').forEach(li => {
      const active = li.dataset.mode === mode;
      li.classList.toggle('active', active);
      const img = li.querySelector('.mi img');
      if (!img) return;
      img.src = active ? (li.dataset.iconActive || li.dataset.icon) : (li.dataset.icon || img.src);
    });
  }

  function hideAllCards(){ $$('.cards-scroll .card').forEach(hideEl); }
  function showCards(mode){ (MODE_CARDS[mode] || []).forEach(id => showEl(document.getElementById(id))); }

  window.selectMode = function(mode){
    // salva last mode in sessione (refresh deve restare)
    try { if (mode && mode !== 'welcome') sessionStorage.setItem(LAST_MODE_KEY, String(mode)); } catch {}

    window.currentMode = mode;

    hideAllCards();
    setPrimaryActionLabel(DEFAULT_PRIMARY_LABEL);
    BtnProcedi?.classList.remove('hidden');

    if (mode === 'welcome'){
      showCards('welcome');
      BtnProcedi?.classList.add('hidden');
      activateMenuVisual('');
      return;
    }

    if (mode === 'qr') setPrimaryActionLabel('Genera QR');
    if (mode === 'iubenda') setPrimaryActionLabel('Genera snippet');
    if (mode === 'ppt') BtnProcedi?.classList.add('hidden');

    showCards(mode);
    try { window.handleCropUI && window.handleCropUI(); } catch {}
    activateMenuVisual(mode);
  };

  SideMenu?.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    window.selectMode(li.dataset.mode || 'welcome');
  });

  function restoreFromLastMode(){
    try {
      const force = sessionStorage.getItem(FORCE_WELCOME_KEY) === '1';
      const last = sessionStorage.getItem(LAST_MODE_KEY);
      if (!force && last && MODE_CARDS[last]){
        window.selectMode(last);
        return true;
      }
    } catch {}
    return false;
  }

  document.addEventListener('DOMContentLoaded', () => {
    initSidebarIcons();

    // 1) restore immediato
    const restored = restoreFromLastMode();
    if (!restored) window.selectMode('welcome');

    // 2) anti-race: se qualche script ti ributta in welcome dopo 200-1500ms,
    //    riportiamo alla modalità precedente (solo se NON hai forzato welcome)
    let ticks = 0;
    const t = setInterval(() => {
      ticks++;
      try {
        const force = sessionStorage.getItem(FORCE_WELCOME_KEY) === '1';
        const last = sessionStorage.getItem(LAST_MODE_KEY);
        if (!force && last && MODE_CARDS[last] && window.currentMode === 'welcome'){
          window.selectMode(last);
        }
      } catch {}
      if (ticks > 20) clearInterval(t); // ~2s
    }, 100);

    // se force_welcome era 1, lo consumiamo una volta qui (welcome.js lo setta su click logo)
    try {
      if (sessionStorage.getItem(FORCE_WELCOME_KEY) === '1') sessionStorage.removeItem(FORCE_WELCOME_KEY);
    } catch {}
  });

})();
