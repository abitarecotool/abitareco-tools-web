/* ----------------------- Shell: sidebar & footer ---------------------- */
const SideMenu = $('#SideMenu');
const BtnProcedi = $('#BtnProcedi');
const ActionProgressWrap  = $('#ActionProgressWrap');
const ActionProgress      = $('#ActionProgress');
const ActionProgressLabel = $('#ActionProgressLabel');

// Primary action button label helper
const DEFAULT_PRIMARY_LABEL = 'Esporta ora';
function setPrimaryActionLabel(txt){
  if (!BtnProcedi) return;
  BtnProcedi.textContent = txt || DEFAULT_PRIMARY_LABEL;
}


/* ------------------------------ Cards UID ----------------------------- */
const WelcomeCard    = $('#WelcomeCard');
const SlugCard       = $('#SlugCard');
const FormatCard     = $('#FormatCard');
const UploadCard     = $('#UploadCard');
const DTCard         = $('#DTCard');
const RenameCard     = $('#RenameCard');
const VideoCard      = $('#VideoCard');
const WatermarkCard  = $('#WatermarkCard');
const BvCard         = $('#BusinessCardCard');
const QrCard         = $('#QrCard');
const IubCard        = $('#IubendaCard');
const PptFontsCard   = $('#PptFontsCard');
const PptCorporateCard = $('#PptCorporateCard');
const PptAdvisorCard = $('#PptAdvisorCard');
const PptMarketingCard = $('#PptMarketingCard');

const ALL_CARDS = [
  WelcomeCard, SlugCard, FormatCard, UploadCard,
  DTCard, RenameCard, VideoCard, WatermarkCard,
  BvCard, QrCard, IubCard,
  PptFontsCard, PptCorporateCard, PptAdvisorCard, PptMarketingCard
];

/* ------------------------------- Stato -------------------------------- */
let picked = [];        // Immagini / PDF / ecc.
let pickedRename = [];  // Rename
let pickedVideo = [];   // Video
let currentMode = null;


// ========================= RESET globale (post-export) =========================
function resetAllUIAndState(){
  // arrays
  try { picked = []; } catch {}
  try { pickedRename = []; } catch {}
  try { pickedVideo = []; } catch {}
  try { customLogoFile = null; } catch {}

  // --- IMMAGINI ---
  try { document.getElementById('TxtSlugIta').value = ''; } catch {}
  try { document.getElementById('TxtSlugEng').value = ''; } catch {}
  try { document.getElementById('FmtSite1920').checked = true; } catch {}
  try { document.getElementById('FmtSiteShare').checked = false; } catch {}
  try { document.getElementById('FmtSiteCustom').checked = false; } catch {}
  try { document.getElementById('CustomW').value = 1920; } catch {}
  try { document.getElementById('CustomH').value = 1080; } catch {}
  try { toggleCustomRow(); } catch {}
  try { hideEl(ImageCropCard); } catch {}

  // drop immagini (shared)
  try { document.getElementById('TxtFolderPath').textContent = 'Trascina qui la cartella o clicca per sfogliare…'; } catch {}
  try { document.getElementById('BtnClearPath').classList.add('hidden'); } catch {}

  // --- PDF → JPG usa lo stesso DropArea/picked: pulito sopra ---

  // --- RENAME ---
  try { document.getElementById('TxtRenameBase').value = ''; } catch {}
  try { document.getElementById('TxtFolderRename').textContent = 'Trascina qui la cartella o clicca per sfogliare…'; } catch {}
  try { document.getElementById('BtnClearRename').classList.add('hidden'); } catch {}

  // --- VIDEO ---
  try { document.getElementById('VidTitle').value = ''; } catch {}
  try { document.getElementById('VidDuration').value = '30'; } catch {}
  try { document.getElementById('VidFmtH').checked = true; } catch {}
  try { document.getElementById('VidFmtV').checked = false; } catch {}
  try { document.getElementById('VidFmtS').checked = false; } catch {}
  try { document.getElementById('TxtFolderVideo').textContent = 'Trascina qui la cartella o clicca per sfogliare…'; } catch {}
  try { document.getElementById('BtnClearVideo').classList.add('hidden'); } catch {}

  // --- WATERMARK ---
  try { document.getElementById('TxtLogoName').textContent = 'Trascina qui il logo o clicca per sfogliare… (PNG trasparente)'; } catch {}
  try { document.getElementById('BtnClearLogo').classList.add('hidden'); } catch {}

  // --- BIGLIETTO DA VISITA ---
  try {
    document.querySelectorAll('.brand-pill').forEach(p => p.classList.remove('active'));
    const form = document.getElementById('BvForm');
    if (form) form.classList.add('hidden');
  } catch {}
  ['BvFullName','BvJobTitle','BvPhone','BvEmail','BvRea'].forEach(id => {
    try { const el = document.getElementById(id); if (el) el.value = ''; } catch {}
  });
  try { const cb = document.getElementById('BvHasRea'); if (cb) cb.checked = false; } catch {}
  try { document.getElementById('BvReaWrap')?.classList.add('hidden'); } catch {}
  try { document.getElementById('BvReaInput')?.classList.add('hidden'); } catch {}

  // --- QR ---
  ['QrBase','QrSource','QrMedium','QrCampaign','QrId','QrTerm','QrContent','QrGeneratedUrl'].forEach(id => {
    try { const el = document.getElementById(id); if (el) el.value = ''; } catch {}
  });

  // --- IUBENDA ---
  ['IubWidgetUrl','IubSiteId','IubCookieIt','IubCookieEn'].forEach(id => {
    try { const el = document.getElementById(id); if (el) el.value = ''; } catch {}
  });
  try { const el = document.getElementById('IubDualLang'); if (el) el.checked = false; } catch {}
  try { document.getElementById('IubCookieEnWrap')?.classList.add('hidden'); } catch {}
  try { const out = document.getElementById('IubOut'); if (out) out.value = ''; } catch {}

  // progress UI
  try { hideEl(ActionProgressWrap); } catch {}
  try { ActionProgress.value = 0; } catch {}
  try { ActionProgressLabel.textContent = 'Elaborazione…'; } catch {}
}
/* ------------------------ Sidebar: icone & nav ------------------------ */
function initSidebarIcons(){
  $$('#SideMenu li').forEach(li=>{
    const img = li.querySelector('.mi img');
    if (img && li.dataset.icon) img.src = li.dataset.icon;
  });
}
function activateMenuVisual(mode){
  $$('#SideMenu li').forEach(li=>{
    const active = li.dataset.mode === mode;
    li.classList.toggle('active', active);
    const img = li.querySelector('.mi img');
    if (!img) return;
    img.src = active ? (li.dataset.iconActive || li.dataset.icon)
                     : (li.dataset.icon || img.src);
  });
}
function selectMode(mode){
  currentMode = mode;
  ALL_CARDS.forEach(hideEl);
  // assicura che il crop non resti visibile fuori dalla modalità Immagini
  try { hideEl(ImageCropCard); } catch {}
  // reset primary action button for each mode (QR overrides below)
  setPrimaryActionLabel(DEFAULT_PRIMARY_LABEL);
  if (BtnProcedi) BtnProcedi.disabled = false;
  BtnProcedi.classList.remove('hidden');

  switch(mode){
    case 'welcome':
      showEl(WelcomeCard);
      BtnProcedi.classList.add('hidden');
      activateMenuVisual('');
      return;

    case 'images':
      showEl(SlugCard); showEl(FormatCard); showEl(UploadCard);
      try { toggleCustomRow(); } catch {}
      break;

    case 'digitaltool':
      showEl(DTCard); showEl(UploadCard);
      break;

    case 'pdf2jpg':
      showEl(UploadCard);
      break;

    case 'rename':
      showEl(RenameCard);
      break;

    case 'video':
      showEl(VideoCard);
      break;

    case 'watermark':
      showEl(UploadCard); showEl(WatermarkCard);
      break;

    case 'bv':
      showEl(BvCard);
      BtnProcedi.classList.remove('hidden');
      break;

    case 'qr':
      showEl(QrCard);
      BtnProcedi.classList.remove('hidden');
      setPrimaryActionLabel('Genera QR');
      try { updateQrGeneratedUrl(); } catch {}
      break;

    case 'iubenda':
      showEl(IubCard);
      BtnProcedi.classList.remove('hidden');
      setPrimaryActionLabel('Genera snippet');
      try { iubSyncEnVisibility(); } catch {}
      break;

    case 'ppt':
      showEl(PptFontsCard);
      showEl(PptCorporateCard);
      showEl(PptAdvisorCard);
      showEl(PptMarketingCard);
      BtnProcedi.classList.add('hidden');
      break;

    default:
      showEl(WelcomeCard);
      BtnProcedi.classList.add('hidden');
      activateMenuVisual('');
      return;
  }
  activateMenuVisual(mode);
}
SideMenu?.addEventListener('click', (e)=>{
  const li = e.target.closest('li');
  if (!li) return;
  selectMode(li.dataset.mode || 'welcome');
});
initSidebarIcons();
selectMode('welcome');


