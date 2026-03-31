/* =========================================================
   Abitare Co. – Digital Content Tool (Web)
   ========================================================= */
"use strict";

/* ---------------------------- Helpers base ---------------------------- */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const showEl = (el) => el && el.classList.remove('hidden');
const hideEl = (el) => el && el.classList.add('hidden');

/* ----------------------- Shell: sidebar & footer ---------------------- */
const SideMenu = $('#SideMenu');
const BtnProcedi = $('#BtnProcedi');
const ActionProgressWrap  = $('#ActionProgressWrap');
const ActionProgress      = $('#ActionProgress');
const ActionProgressLabel = $('#ActionProgressLabel');

/* ------------------------------ Cards UID ----------------------------- */
const WelcomeCard = $('#WelcomeCard');
const SlugCard    = $('#SlugCard');
const FormatCard  = $('#FormatCard');
const UploadCard  = $('#UploadCard');
const DTCard      = $('#DTCard');
const RenameCard  = $('#RenameCard');
const VideoCard   = $('#VideoCard');
const WatermarkCard = $('#WatermarkCard');
const BvCard      = $('#BusinessCardCard');
const QrCard      = $('#QrCard');
const IubCard     = $('#IubendaCard');

const ALL_CARDS = [
  WelcomeCard, SlugCard, FormatCard, UploadCard,
  DTCard, RenameCard, VideoCard, WatermarkCard, BvCard, QrCard, IubCard
];

/* ------------------------------- Stato -------------------------------- */
let picked        = [];   // Per Immagini / DigitalTool / PDF
let currentMode   = 'welcome';

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
    img.src = active
      ? (li.dataset.iconActive || li.dataset.icon)
      : (li.dataset.icon || img.src);
  });
}
function selectMode(mode){
  currentMode = mode;
  ALL_CARDS.forEach(hideEl);
  showEl(BtnProcedi);

  switch(mode){
    case 'welcome':
      showEl(WelcomeCard);
      hideEl(BtnProcedi);
      activateMenuVisual('');
      return;
    case 'images':
    case 'images-share':
      showEl(SlugCard); showEl(FormatCard); showEl(UploadCard);
      break;
    case 'digitaltool':
      showEl(SlugCard); showEl(DTCard); showEl(UploadCard);
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
      showEl(WatermarkCard); showEl(UploadCard);
      break;
    case 'bv':
      showEl(BvCard);
      break;
    case 'qr':
      showEl(QrCard);
      break;
    case 'iubenda':
      showEl(IubCard);
      break;
    default:
      showEl(WelcomeCard);
      hideEl(BtnProcedi);
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

/* ========================= Drag & Drop: GENERALE ====================== */
const DropArea      = $('#DropArea');
const TxtFolderPath = $('#TxtFolderPath');
const BtnClearPath  = $('#BtnClearPath');

if (DropArea) {
  function prevent(e){ e.preventDefault(); e.stopPropagation(); }
  ['dragenter','dragover','dragleave','drop'].forEach(ev =>
    DropArea.addEventListener(ev, prevent)
  );
  DropArea.addEventListener('dragenter', ()=> DropArea.classList.add('drag-over'));
  DropArea.addEventListener('dragleave', ()=> DropArea.classList.remove('drag-over'));
  DropArea.addEventListener('drop', async (e)=>{
    DropArea.classList.remove('drag-over');
    handleDroppedFiles(e.dataTransfer.files);
  });
  DropArea.addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    input.onchange = ()=>{
      handleDroppedFiles(input.files);
    };
    input.click();
  });
  BtnClearPath?.addEventListener('click', (e)=>{
    e.stopPropagation();
    picked = [];
    TxtFolderPath.textContent = 'Trascina qui la cartella…';
    BtnClearPath.classList.add('hidden');
  });
}

function handleDroppedFiles(files) {
  const fl = files ? Array.from(files) : [];
  picked = fl
    .filter(f => /\.(jpe?g|png|tif?f|webp|pdf)$/i.test(f.name))
    .map(f => ({ file:f, relPath:f.webkitRelativePath || f.name }));
  
  if (currentMode === 'watermark') {
    picked = picked.filter(p => /\.(jpe?g|png|tif?f)$/i.test(p.file.name));
  }
  
  TxtFolderPath.textContent = picked.length
    ? `Selezionati ${picked.length} file…`
    : 'Nessun file supportato.';
  BtnClearPath.classList.toggle('hidden', picked.length === 0);
}

/* ========================= Drag & Drop: RENAME ======================== */
const DropAreaRename   = $('#DropAreaRename');
const TxtFolderRename  = $('#TxtFolderRename');
const BtnClearRename   = $('#BtnClearRename');
let pickedRename = [];

if (DropAreaRename) {
  function preventR(e){ e.preventDefault(); e.stopPropagation(); }
  ['dragenter','dragover','dragleave','drop'].forEach(ev =>
    DropAreaRename.addEventListener(ev, preventR)
  );
  DropAreaRename.addEventListener('dragenter', ()=> DropAreaRename.classList.add('drag-over'));
  DropAreaRename.addEventListener('dragleave', ()=> DropAreaRename.classList.remove('drag-over'));
  DropAreaRename.addEventListener('drop', async (e)=>{
    DropAreaRename.classList.remove('drag-over');
    pickedRename = await readDroppedDirectory(e.dataTransfer);
    TxtFolderRename.textContent = pickedRename.length
      ? `Selezionati ${pickedRename.length} file…`
      : 'Nessun file supportato.';
    BtnClearRename.classList.toggle('hidden', pickedRename.length === 0);
  });
  // ... (resto della logica Rename già esistente) ...
}

/* ============================== Immagini Sito ========================== */
// ... (tutta la logica esistente per exportImages) ...

/* =================------------- DigitalTool =========================== */
// ... (tutta la logica esistente per exportDigitalTool) ...

/* ============================== PDF → JPG ============================= */
// ... (tutta la logica esistente per exportPdfToJpg) ...

/* ================================ Rename ============================== */
// ... (tutta la logica esistente per exportRename) ...

/* ============================= VIDEO: Slideshow ======================= */
// ... (tutta la logica esistente per exportVideoSlideshow) ...

/* =================---------- Logica Watermark ========================= */
async function exportWatermark() {
  if (!picked.length) return alert("Carica una cartella con immagini.");
  
  const logoFile = $('#InpWatermarkLogo').files[0];
  if (!logoFile) return alert("Per favore, carica prima il logo PNG trasparente.");

  const zip = new JSZip();
  const logoBmp = await loadImageBitmap(logoFile);
  
  showEl(ActionProgressWrap);
  ActionProgress.value = 0;
  ActionProgressLabel.textContent = "Applicazione Watermark…";

  const total = picked.length; 
  const images = picked.sort((a,b)=>
    (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true })
  );

  for (let i = 0; i < images.length; i++) {
    ActionProgress.value = Math.round(((i + 1) / total) * 100);
    ActionProgressLabel.textContent = `Elaborazione immagine ${i+1}/${total}...`;

    const imgBmp = await loadImageBitmap(images[i].file);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 768;
    const ctx = canvas.getContext('2d');

    // Fondo bianco peroutput JPG
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1024, 768);

    // 1. Resize "Cover" 1024x768 (come -resize 1024x768^ -extent 1024x768)
    const ratio = Math.max(1024 / imgBmp.width, 768 / imgBmp.height);
    const sw = 1024 / ratio, sh = 768 / ratio;
    const sx = (imgBmp.width - sw) / 2, sy = (imgBmp.height - sh) / 2;
    ctx.drawImage(imgBmp, sx, sy, sw, sh, 0, 0, 1024, 768);

    // 2. Applicazione Logo al centro (-gravity center)
    const lx = (1024 - logoBmp.width) / 2;
    const ly = (768 - logoBmp.height) / 2;
    ctx.drawImage(logoBmp, lx, ly);

    // 3. Conversione in JPG al 90% di qualità
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.90));
    
    // Rinomina sequenziale: immagini-01.jpg, immagini-02.jpg, ...
    const fileName = `immagini-${(i + 1).toString().padStart(2, '0')}.jpg`;
    zip.file(`immagini/${fileName}`, blob);
  }

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, "WatermarkPortali_Export.zip");
  
  hideEl(ActionProgressWrap);
  alert("Esportazione Watermark completata!");
}

/* =================---------- Helpers Comuni =================---------- */
async function loadImageBitmap(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);
  return img;
}

/* -------------------------- Dispatcher globale ------------------------ */
BtnProcedi?.addEventListener('click', async ()=>{
  try {
    BtnProcedi.disabled = true;
    if (currentMode === 'images' || currentMode === 'images-share') { alert("Funzione non attiva."); return; }
    if (currentMode === 'digitaltool'){ alert("Funzione non attiva."); return; }
    if (currentMode === 'pdf2jpg')   { alert("Funzione non attiva."); return; }
    if (currentMode === 'rename')    { alert("Funzione non attiva."); return; }
    if (currentMode === 'video')     { alert("Funzione non attiva."); return; }
    if (currentMode === 'watermark') { await exportWatermark(); return; }
    alert("Funzione non attiva o in build futura.");
  } finally {
    BtnProcedi.disabled = false;
  }
});
