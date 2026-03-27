/* =========================================================
   Abitare Co. – Digital Content Tool (Web)
   app.js (UI + navigazione + selezione Formato Immagini Sito)
   ========================================================= */

/* ----- Helpers di base ----- */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const show = (el) => el && el.classList.remove('hidden');
const hide = (el) => el && el.classList.add('hidden');

/* Safe getters per .value/.checked */
const getText = (el) => (el && typeof el.value === 'string') ? el.value.trim() : '';
const getNumber = (el, fallback = 0) => {
  const n = Number(getText(el));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/* ----- Riferimenti DOM (coerenti con i tuoi ID) ----- */
const sideMenu     = $('#SideMenu');
const welcomeCard  = $('#WelcomeCard');
const uploadCard   = $('#UploadCard');
const slugCard     = $('#SlugCard');
const bvCard       = $('#BusinessCardCard');
const qrCard       = $('#QrCard');
const iubCard      = $('#IubendaCard');
const videoCard    = $('#VideoCard');
const formatCard   = $('#FormatCard');

const progress     = $('#MainProgress');
const progressLbl  = $('#ProgressLabel');
const btnProcedi   = $('#BtnProcedi');

/* Upload (drag&drop) */
const dropArea     = $('#DropArea');
const txtFolder    = $('#TxtFolderPath');
const btnClearPath = $('#BtnClearPath');

/* Slug */
const txtSlugIta   = $('#TxtSlugIta');
const txtSlugEng   = $('#TxtSlugEng');

/* FORMATO – Immagini Sito */
const fmt1920      = $('#FmtSite1920');
const fmtShare     = $('#FmtSiteShare');
const fmtCustom    = $('#FmtSiteCustom');
const customRow    = $('#CustomSizeRow');
const customW      = $('#CustomW');
const customH      = $('#CustomH');

/* BV */
const btnBV_AbitareCo   = $('#BtnBV_AbitareCo');
const btnBV_Commercial  = $('#BtnBV_Commercial');
const btnBV_Riabitareco = $('#BtnBV_Riabitareco');
const bvForm            = $('#BvForm');
const chkBvRea          = $('#ChkBvRea');
const reaField          = $('#ReaField');

/* Iubenda */
const chkIubEnableEn = $('#ChkIubEnableEn');
const iubEnPanel     = $('#IubEnPanel');

/* Stato globale minimo (per il prossimo step di export reale) */
let selectedMenuIndex = -1;        // -1 = welcome
let selectedBV        = '';        // 'abitareco' | 'commercial' | 'riabitareco'
let droppedItemsInfo  = null;      // informazioni base su cartella/file selezionati

/* Collezione card principale per show/hide */
const ALL_CARDS = [
  welcomeCard, uploadCard, slugCard, bvCard, qrCard, iubCard, videoCard, formatCard
];

/* =========================================================
   Navigazione sidebar → mostra/nascondi le card esatte
   ========================================================= */
function selectMenu(index) {
  selectedMenuIndex = index;

  // reset view
  ALL_CARDS.forEach(hide);
  hide(btnProcedi);

  // Welcome
  if (index < 0) {
    show(welcomeCard);
    return;
  }

  // default per mod standard: upload visibile + bottone visibile
  show(uploadCard);
  show(btnProcedi);

  // Slug SOLO per mod 0 (Immagini Sito) e 1 (Immagini Share)
  if (index === 0 || index === 1) show(slugCard);

  // Video (5): card video + upload, NO slug
  if (index === 5) { show(videoCard); hide(slugCard); }

  // FORMATO SOLO per “Immagini Sito” (0)
  if (index === 0) show(formatCard);

  // BV (7)
  if (index === 7) {
    hide(uploadCard); hide(slugCard); hide(qrCard); hide(iubCard); hide(videoCard); hide(formatCard);
    show(bvCard);
    // reset UI BV
    selectedBV = '';
    [btnBV_AbitareCo, btnBV_Commercial, btnBV_Riabitareco].forEach(b => b?.classList.remove('is-selected'));
    hide(bvForm); hide(reaField); if (chkBvRea) chkBvRea.checked = false;
  }

  // QR (8)
  if (index === 8) {
    hide(uploadCard); hide(slugCard); hide(bvCard); hide(iubCard); hide(videoCard); hide(formatCard);
    show(qrCard);
  }

  // Iubenda (9)
  if (index === 9) {
    hide(uploadCard); hide(slugCard); hide(bvCard); hide(qrCard); hide(videoCard); hide(formatCard);
    show(iubCard);
  }

  // evidenzia selezione in sidebar
  $$('#SideMenu li').forEach(li => li.classList.remove('active'));
  const active = $(`#SideMenu li[data-index="${index}"]`);
  if (active) active.classList.add('active');
}

/* Init: mostra “Welcome” */
selectMenu(-1);

/* Click menu */
sideMenu?.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const idx = parseInt(li.dataset.index, 10);
  selectMenu(idx);
});

/* =========================================================
   Drag & Drop (placeholder: UI + info base)
   - Nel prossimo step, useremo input directory / File System Access
   ========================================================= */
function dropPreventDefaults(e){
  e.preventDefault();
  e.stopPropagation();
}
['dragenter','dragover','dragleave','drop'].forEach(ev => {
  dropArea?.addEventListener(ev, dropPreventDefaults);
});
dropArea?.addEventListener('dragenter', () => dropArea.classList.add('focus'));
dropArea?.addEventListener('dragleave', () => dropArea.classList.remove('focus'));
dropArea?.addEventListener('drop', async (e) => {
  dropArea.classList.remove('focus');
  const dt = e.dataTransfer;
  const files = dt?.files ? Array.from(dt.files) : [];
  droppedItemsInfo = {
    count: files.length,
    names: files.slice(0,5).map(f => f.name)
  };
  if (files.length > 0) {
    txtFolder.textContent = `Selezionati ${files.length} file…`;
  } else {
    txtFolder.textContent = 'Cartella selezionata (placeholder)…';
  }
  btnClearPath?.classList.remove('hidden');
});
btnClearPath?.addEventListener('click', () => {
  droppedItemsInfo = null;
  txtFolder.textContent = 'Trascina qui la cartella...';
  btnClearPath.classList.add('hidden');
});

/* =========================================================
   FORMATO – Immagini Sito
   ========================================================= */
function toggleCustomRow(){
  if (fmtCustom?.checked) show(customRow);
  else hide(customRow);
}
[fmt1920, fmtShare, fmtCustom].forEach(r => r?.addEventListener('change', toggleCustomRow));
toggleCustomRow();

/* Ritorna il formato selezionato per Immagini Sito */
function getSelectedSiteFormat(){
  if (fmtCustom?.checked) {
    const w = getNumber(customW, 1920);
    const h = getNumber(customH, 1080);
    return { label: `${w}x${h} (custom)`, w, h, preset: 'custom' };
  }
  if (fmtShare?.checked) {
    return { label: '1200x630 (share)', w:1200, h:630, preset: 'share' };
  }
  // default 1920x1080
  return { label: '1920x1080 (H)', w:1920, h:1080, preset: '1920x1080' };
}

/* =========================================================
   BV – selezione brand + REA
   ========================================================= */
function selectBV(brand){
  selectedBV = brand;
  [btnBV_AbitareCo, btnBV_Commercial, btnBV_Riabitareco].forEach(b => b?.classList.remove('is-selected'));
  if (brand === 'abitareco') btnBV_AbitareCo?.classList.add('is-selected');
  if (brand === 'commercial') btnBV_Commercial?.classList.add('is-selected');
  if (brand === 'riabitareco') btnBV_Riabitareco?.classList.add('is-selected');
  show(bvForm);
  if (brand === 'abitareco') {
    show(chkBvRea?.closest('.checkline'));
  } else {
    hide(reaField);
    if (chkBvRea) chkBvRea.checked = false;
  }
}
btnBV_AbitareCo ?.addEventListener('click', () => selectBV('abitareco'));
btnBV_Commercial?.addEventListener('click', () => selectBV('commercial'));
btnBV_Riabitareco?.addEventListener('click', () => selectBV('riabitareco'));
chkBvRea?.addEventListener('change', () => (chkBvRea.checked ? show(reaField) : hide(reaField)));

/* =========================================================
   Iubenda – toggle EN panel
   ========================================================= */
chkIubEnableEn?.addEventListener('change', () => (chkIubEnableEn.checked ? show(iubEnPanel) : hide(iubEnPanel)));

/* =========================================================
   Pulsante “Esporta ora”
   - Per ora: solo raccolta parametri + progress fake
   - Prossimo step: integriamo export reale (Canvas/Squoosh/JSZip)
   ========================================================= */
function startProgressFake(msTotal = 1400){
  progress.value = 0;
  progressLbl?.classList.remove('hidden');
  progress?.classList.remove('hidden');
  const step = 120;
  const inc  = 100 / Math.ceil(msTotal/step);
  const t = setInterval(() => {
    progress.value = Math.min(100, progress.value + inc);
    if (progress.value >= 100){
      clearInterval(t);
      setTimeout(() => {
        progress.value = 0;
        progressLbl?.classList.add('hidden');
        progress?.classList.add('hidden');
      }, 350);
    }
  }, step);
}

/* Raccoglie i parametri per tutti i mod; useremo questi nell’export reale */
function gatherConfig(){
  const cfg = { mode: selectedMenuIndex };

  // Upload (placeholder)
  cfg.inputInfo = droppedItemsInfo;

  if (selectedMenuIndex === 0) {
    // Immagini Sito
    cfg.slugIta = getText(txtSlugIta);
    cfg.slugEng = getText(txtSlugEng);
    cfg.format  = getSelectedSiteFormat();        // {w,h,preset,label}
  }
  else if (selectedMenuIndex === 1) {
    // Immagini Share (in futuro: preset 1200x630 fisso o opzioni simili)
    cfg.slugIta = getText(txtSlugIta);
    cfg.slugEng = getText(txtSlugEng);
  }
  else if (selectedMenuIndex === 7) {
    // BV: i campi del form verranno letti quando integriamo pdf-lib
    cfg.bvBrand = selectedBV; // 'abitareco' | 'commercial' | 'riabitareco'
  }
  // (8) QR, (9) Iubenda, etc. li completiamo nei rispettivi step

  return cfg;
}

btnProcedi?.addEventListener('click', () => {
  if (selectedMenuIndex < 0) {
    alert('Seleziona una modalità dal menu laterale.');
    return;
  }

  // Piccole validazioni base per le modalità già attive
  if (selectedMenuIndex === 0) {
    // Immagini Sito
    const ita = getText(txtSlugIta);
    const eng = getText(txtSlugEng);
    if (!ita || !eng) { alert('Inserisci gli slug ITA/ENG.'); return; }
    if (!droppedItemsInfo) { alert('Seleziona o trascina una cartella/file.'); return; }
  }

  const cfg = gatherConfig();
  console.log('CONFIG →', cfg); // DEBUG: per vedere cosa passa l’UI

  // Per ora avviamo solo un progress "fake".
  // PROSSIMO STEP: qui chiamiamo la funzione di export reale.
  startProgressFake();
});

/* =========================================================
   Fine
   ========================================================= */
