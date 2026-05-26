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
  function setPrimaryActionLabel(txt){ if (BtnProcedi) BtnProcedi.textContent = txt || DEFAULT_PRIMARY_LABEL; }

  const MODE_CARDS = {
    welcome: ['WelcomeCard'],
    images: ['SlugCard','FormatCard','UploadCard'],
    platform: ['PlatformCard'],
    digitaltool: ['DTCard','UploadCard'],
    pdf2jpg: ['UploadCard'],
    rename: ['RenameCard'],
    video: ['VideoCard'],
    watermark: ['WatermarkCard','UploadCard'],
    bv: ['BusinessCardCard'],
    qr: ['QrCard'],
    iubenda: ['IubendaCard'],
    ppt: ['PptFontsCard','PptCorporateCard','PptAdvisorCard','PptMarketingCard'],
 fattura: ['FatturaCard']
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
    if (mode === 'platform') setPrimaryActionLabel('Esporta sezione');
 if (mode === 'fattura') setPrimaryActionLabel('Esporta PDF');
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

  document.addEventListener('DOMContentLoaded', () => {
    initSidebarIcons();
    window.selectMode('welcome');
  });
})();