/* =========================================================
   Abitare Co. – Digital Content Tool (Web)
   app.js — Immagini + DigitalTool (WEBP/JPG split) + PDF→JPG + Rename UI
   ========================================================= */

"use strict";

/* Helpers base */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const showEl = (el) => el && el.classList.remove('hidden');
const hideEl = (el) => el && el.classList.add('hidden');

/* Sidebar & ActionBar */
const SideMenu = $('#SideMenu');
const BtnProcedi = $('#BtnProcedi');
const ActionProgressWrap = $('#ActionProgressWrap');
const ActionProgress     = $('#ActionProgress');
const ActionProgressLabel= $('#ActionProgressLabel');

/* Cards */
const WelcomeCard  = $('#WelcomeCard');
const SlugCard     = $('#SlugCard');
const FormatCard   = $('#FormatCard');
const UploadCard   = $('#UploadCard');
const DTCard       = $('#DTCard');
const PdfCard      = $('#PdfCard');
const RenameCard   = $('#RenameCard');
const VideoCard    = $('#VideoCard');
const BvCard       = $('#BusinessCardCard');
const QrCard       = $('#QrCard');
const IubCard      = $('#IubendaCard');
const ALL_CARDS    = [WelcomeCard, SlugCard, FormatCard, UploadCard, DTCard, PdfCard, RenameCard, VideoCard, BvCard, QrCard, IubCard];

/* Stato */
let picked = [];           // [{file, relPath}]
let currentMode = null;    // 'images' | 'digitaltool' | 'pdf2jpg' | 'rename' | ...

/* Icone sidebar */
function initSidebarIcons(){
  $$('#SideMenu li').forEach(li=>{
    const img = li.querySelector('.mi img');
    if (img && li.dataset.icon) img.src = li.dataset.icon;
  });
}
function activateMenuVisual(mode){
  $$('#SideMenu li').forEach(li=>{
    li.classList.toggle('active', li.dataset.mode === mode);
    const img = li.querySelector('.mi img');
    if (!img) return;
    img.src = (li.dataset.mode === mode ? (li.dataset.iconActive || li.dataset.icon) : (li.dataset.icon || img.src));
  });
}

/* Navigazione */
function selectMode(mode){
  currentMode = mode;
  ALL_CARDS.forEach(hideEl);
  BtnProcedi.classList.remove('hidden'); // visibile di default

  switch(mode){
    case 'welcome':
      showEl(WelcomeCard);
      BtnProcedi.classList.add('hidden'); // nessun bottone in welcome
      activateMenuVisual('');
      return;

    case 'images':
      showEl(SlugCard); showEl(FormatCard); showEl(UploadCard); break;

    case 'digitaltool':
      showEl(UploadCard); showEl(DTCard); break;

    case 'pdf2jpg':
      showEl(UploadCard); showEl(PdfCard); break;

    case 'rename':
      showEl(UploadCard); showEl(RenameCard); break;

    case 'video':      showEl(UploadCard); showEl(VideoCard); break;
    case 'watermark':  showEl(UploadCard); break;
    case 'bv':         showEl(BvCard); break;
    case 'qr':         showEl(QrCard); break;
    case 'iubenda':    showEl(IubCard); break;

    default:
      showEl(WelcomeCard);
      BtnProcedi.classList.add('hidden');
      activateMenuVisual('');
      return;
  }
  activateMenuVisual(mode);
}

/* Sidebar click */
SideMenu?.addEventListener('click', (e)=>{
  const li = e.target.closest('li'); if (!li) return;
  selectMode(li.dataset.mode || 'welcome');
});

/* Avvio */
initSidebarIcons();
selectMode('welcome');

/* =================== Upload: drag&drop + click per directory =================== */
const DropArea = $('#DropArea');
const TxtFolderPath = $('#TxtFolderPath');
const BtnClearPath  = $('#BtnClearPath');

function prevent(e){ e.preventDefault(); e.stopPropagation(); }
['dragenter','dragover','dragleave','drop'].forEach(ev=> DropArea?.addEventListener(ev, prevent));
DropArea?.addEventListener('dragenter', ()=> DropArea.classList.add('drag-over'));
DropArea?.addEventListener('dragleave', ()=> DropArea.classList.remove('drag-over'));
DropArea?.addEventListener('drop', async (e)=>{
  DropArea.classList.remove('drag-over');
  picked = await readDroppedDirectory(e.dataTransfer);
  TxtFolderPath.textContent = picked.length ? `Selezionati ${picked.length} file…` : 'Nessun file supportato.';
  BtnClearPath.classList.toggle('hidden', picked.length===0);
});
DropArea?.addEventListener('click', ()=>{
  const input = document.createElement('input');
  input.type = 'file';
  input.webkitdirectory = true;
  input.multiple = true;
  input.onchange = ()=>{
    const fl = input.files ? Array.from(input.files) : [];
    picked = fl
      .filter(f => /\.(jpe?g|png|tif?f|webp|pdf)$/i.test(f.name))
      .map(f => ({ file:f, relPath: f.webkitRelativePath || f.name }));
    TxtFolderPath.textContent = picked.length ? `Selezionati ${picked.length} file…` : 'Nessun file supportato.';
    BtnClearPath.classList.toggle('hidden', picked.length===0);
  };
  input.click();
});
BtnClearPath?.addEventListener('click', (e)=>{
  e.stopPropagation();
  picked = [];
  TxtFolderPath.textContent = 'Trascina qui la cartella...';
  BtnClearPath.classList.add('hidden');
});

/* Lettura ricorsiva da DataTransferItem (webkitGetAsEntry) */
async function readDroppedDirectory(dt){
  const items = dt?.items ? Array.from(dt.items) : [];
  const out = [];
  async function traverse(entry, base=''){
    if (entry.isFile){
      const f = await new Promise(res=> entry.file(res));
      if (/\.(jpe?g|png|tif?f|webp|pdf)$/i.test(f.name)){
        out.push({ file:f, relPath: (base ? `${base}/${f.name}` : f.name) });
      }
    } else if (entry.isDirectory){
      const reader = entry.createReader();
      const entries = await new Promise(res=> reader.readEntries(res));
      for (const en of entries) await traverse(en, base ? `${base}/${entry.name}` : entry.name);
    }
  }
  const hasEntries = items.length && typeof items[0].webkitGetAsEntry === 'function';
  if (hasEntries){
    for (const it of items){
      const en = it.webkitGetAsEntry();
      if (en) await traverse(en, '');
    }
  }
  return out;
}

/* =================== Helpers immagini/canvas =================== */
function slugify(t){
  if (!t) return '';
  return t.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[’'`]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}
async function loadImageBitmap(file){
  const url = URL.createObjectURL(file);
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { imageOrientation:'from-image' });
  URL.revokeObjectURL(url);
  return bmp;
}
function drawCoverToCanvas(bmp, W, H){
  const canvas = document.createElement('canvas');
  canvas.width=W; canvas.height=H;
  const ctx = canvas.getContext('2d');
  const scale = Math.max(W/bmp.width, H/bmp.height);
  const dw = Math.round(bmp.width*scale), dh = Math.round(bmp.height*scale);
  const dx = Math.round((W-dw)/2), dy = Math.round((H-dh)/2);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality='high';
  ctx.drawImage(bmp, dx, dy, dw, dh);
  return canvas;
}
function canvasToBlob(canvas, mime, q=0.85){ return new Promise(res=> canvas.toBlob(res, mime, q)); }

/* =================== IMMAGINI =================== */
const TxtSlugIta = $('#TxtSlugIta');
const TxtSlugEng = $('#TxtSlugEng');
const Fmt1920   = $('#FmtSite1920');
const FmtShare  = $('#FmtSiteShare');
const FmtCustom = $('#FmtSiteCustom');
const CustomRow = $('#CustomSizeRow');
const CustomW   = $('#CustomW');
const CustomH   = $('#CustomH');

function toggleCustomRow(){ FmtCustom?.checked ? showEl(CustomRow) : hideEl(CustomRow); }
[Fmt1920, FmtShare, FmtCustom].forEach(r=> r?.addEventListener('change', toggleCustomRow));
toggleCustomRow();

function getSelectedFormat(){
  if (FmtCustom?.checked){
    const w = Math.max(1, Number(CustomW?.value)||1920);
    const h = Math.max(1, Number(CustomH?.value)||1080);
    return {w,h};
  }
  if (FmtShare?.checked) return {w:1200,h:630};
  return {w:1920,h:1080};
}

// (opzionale) mappa IT→EN da assets/folder_map.csv
async function loadFolderMap(){
  try{
    const res = await fetch('./assets/folder_map.csv', {cache:'no-store'});
    if (!res.ok) return {};
    const txt = await res.text();
    const rows = txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if (!rows.length) return {};
    const header = rows[0].split(',').map(h=>h.trim().toLowerCase());
    const iITA = header.findIndex(h=> ['ita','it'].includes(h));
    const iENG = header.findIndex(h=> ['eng','en'].includes(h));
    if (iITA<0 || iENG<0) return {};
    const map = {};
    for (let i=1;i<rows.length;i++){
      const cols = rows[i].split(',');
      const ita = (cols[iITA]||'').trim().toLowerCase();
      const eng = (cols[iENG]||'').trim();
      if (ita && eng) map[ita] = eng;
    }
    return map;
  }catch{ return {}; }
}

async function exportImages(){
  const slugIta = slugify(TxtSlugIta?.value||'');
  const slugEng = slugify(TxtSlugEng?.value||'');
  if (!slugIta || !slugEng){ alert('Inserisci i nomi file ITA/ENG.'); return; }

  const images = picked.filter(p => /\.(jpe?g|png|tif?f)$/i.test(p.file.name));
  if (!images.length){ alert('Seleziona o trascina una cartella con immagini.'); return; }

  const {w:W, h:H} = getSelectedFormat();
  const folderMap = await loadFolderMap();

  const groups = new Map();
  for (const rec of images){
    const p = rec.relPath || rec.file.name;
    const folder = p.includes('/') ?
