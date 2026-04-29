// js/core/shell.js
// Router UI: mostra/nasconde le card per modalità + sidebar icons

(function(){
  'use strict';

  // Helpers (già presenti in helpers.js)
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const showEl = (el) => el && el.classList.remove('hidden');
  const hideEl = (el) => el && el.classList.add('hidden');

  // Sidebar
  const SideMenu = $('#SideMenu');

  // Primary action
  const BtnProcedi = $('#BtnProcedi');
  const DEFAULT_PRIMARY_LABEL = 'Esporta ora';
  function setPrimaryActionLabel(txt){
    if (!BtnProcedi) return;
    BtnProcedi.textContent = txt || DEFAULT_PRIMARY_LABEL;
  }

  // Cards
  const WelcomeCard = $('#WelcomeCard');
  const SlugCard = $('#SlugCard');
  const FormatCard = $('#FormatCard');
  const UploadCard = $('#UploadCard');
  const DTCard = $('#DTCard');
  const RenameCard = $('#RenameCard');
  const VideoCard = $('#VideoCard');
  const WatermarkCard = $('#WatermarkCard');
  const BvCard = $('#BusinessCardCard');
  const QrCard = $('#QrCard');
  const IubCard = $('#IubendaCard');
  const PptFontsCard = $('#PptFontsCard');
  const PptCorporateCard = $('#PptCorporateCard');
  const PptAdvisorCard = $('#PptAdvisorCard');
  const PptMarketingCard = $('#PptMarketingCard');

  // Crop card (immagini)
  const ImageCropCard = $('#ImageCropCard');

  const ALL_CARDS = [
    WelcomeCard, SlugCard, FormatCard, UploadCard,
    DTCard, RenameCard, VideoCard, WatermarkCard,
    BvCard, QrCard, IubCard,
    PptFontsCard, PptCorporateCard, PptAdvisorCard, PptMarketingCard,
    ImageCropCard
  ].filter(Boolean);

  // Stato globale (definito altrove, ma qui lo aggiorniamo)
  if (typeof window.currentMode === 'undefined') window.currentMode = null;

  // Mode -> card IDs (fix: BV/QR/Iubenda/PPT erano bianchi perché non mappati)
  const MODE_SHOW = {
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

  function hideAllCards(){
    ALL_CARDS.forEach(hideEl);
  }

  function showCardsForMode(mode){
    const ids = MODE_SHOW[mode] || [];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) showEl(el);
    });
  }

  // API globale usata dal resto dell'app
  window.selectMode = function selectMode(mode){
    window.currentMode = mode;

    hideAllCards();

    // reset bottone principale
    setPrimaryActionLabel(DEFAULT_PRIMARY_LABEL);
    if (BtnProcedi) BtnProcedi.disabled = false;
    BtnProcedi?.classList.remove('hidden');

    // Mostra/nascondi bottone in base al mode
    if (mode === 'welcome') {
      showCardsForMode('welcome');
      BtnProcedi?.classList.add('hidden');
      activateMenuVisual('');
      return;
    }

    // Mostra le card del mode
    showCardsForMode(mode);

    // Crop: viene gestito dal modulo immagini (handleCropUI)
    try { window.handleCropUI && window.handleCropUI(); } catch {}

    activateMenuVisual(mode);
  };

  SideMenu?.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    window.selectMode(li.dataset.mode || 'welcome');
  });

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    initSidebarIcons();
    window.selectMode('welcome');
  });

})();
