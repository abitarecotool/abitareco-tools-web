/* =========================================================
 Abitare Co. – Digital Content Tool (Web)
 app.js — Immagini + DigitalTool + PDF→JPG + Rename + Video + Watermark (auto)
        + BV (Akrobat / Calibri + REA dinamico) + QR + Iubenda + PPT
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
      BtnProcedi.classList.add('hidden');
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

/* ========================= Drag & Drop: GENERALE ====================== */
const DropArea      = $('#DropArea');
const TxtFolderPath = $('#TxtFolderPath');
const BtnClearPath  = $('#BtnClearPath');

if (DropArea) {
  const prevent = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => DropArea.addEventListener(ev, prevent));
  DropArea.addEventListener('dragenter', ()=> DropArea.classList.add('drag-over'));
  DropArea.addEventListener('dragleave', ()=> DropArea.classList.remove('drag-over'));
  DropArea.addEventListener('drop', async (e)=>{
    DropArea.classList.remove('drag-over');
    picked = await readDroppedDirectory(e.dataTransfer);
    TxtFolderPath.textContent = picked.length
      ? `Selezionati ${picked.length} file…`
      : 'Nessun file supportato.';
    BtnClearPath.classList.toggle('hidden', picked.length === 0);
  });
  DropArea.addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file'; input.webkitdirectory = true; input.multiple = true;
    input.onchange = ()=>{
      const fl = input.files ? Array.from(input.files) : [];
      picked = fl
        .filter(f => /\.(jpe?g|png|tif?f|webp|pdf)$/i.test(f.name))
        .map(f => ({ file:f, relPath:f.webkitRelativePath || f.name }));
      TxtFolderPath.textContent = picked.length
        ? `Selezionati ${picked.length} file…`
        : 'Nessun file supportato.';
      BtnClearPath.classList.toggle('hidden', picked.length === 0);
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

/* ========================= Drag & Drop: RENAME ======================== */
const DropAreaRename  = $('#DropAreaRename');
const TxtFolderRename = $('#TxtFolderRename');
const BtnClearRename  = $('#BtnClearRename');

if (DropAreaRename) {
  const preventR = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => DropAreaRename.addEventListener(ev, preventR));
  DropAreaRename.addEventListener('dragenter', ()=> DropAreaRename.classList.add('drag-over'));
  DropAreaRename.addEventListener('dragleave', ()=> DropAreaRename.classList.remove('drag-over'));
  DropAreaRename.addEventListener('drop', async (e)=>{
    DropAreaRename.classList.remove('drag-over');
    pickedRename = await readDroppedDirectory(e.dataTransfer);
    TxtFolderRename.textContent = pickedRename.length
      ? `Selezionati ${picked.length} file…`
      : 'Nessun file supportato.';
    BtnClearRename.classList.toggle('hidden', pickedRename.length === 0);
  });
  DropAreaRename.addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file'; input.webkitdirectory = true; input.multiple = true; input.accept = 'image/*';
    input.onchange = ()=>{
      const fl = input.files ? Array.from(input.files) : [];
      pickedRename = fl
        .filter(f => /\.(jpe?g|png|tif?f|webp)$/i.test(f.name))
        .map(f => ({ file:f, relPath:f.webkitRelativePath || f.name }));
      TxtFolderRename.textContent = pickedRename.length
        ? `Selezionati ${pickedRename.length} file…`
        : 'Nessun file supportato.';
      BtnClearRename.classList.toggle('hidden', pickedRename.length === 0);
    };
    input.click();
  });
  BtnClearRename?.addEventListener('click', (e)=>{
    e.stopPropagation();
    pickedRename = [];
    TxtFolderRename.textContent = 'Trascina qui la cartella…';
    BtnClearRename.classList.add('hidden');
  });
}

/* ======================= Utility: lettura cartelle ==================== */
async function readDroppedDirectory(dt){
  const items = dt?.items ? Array.from(dt.items) : [];
  const out = [];
  async function traverse(entry, base=''){
    if (entry.isFile){
      const f = await new Promise(res => entry.file(res));
      if (/\.(jpe?g|png|tif?f|webp|pdf)$/i.test(f.name)){
        out.push({ file: f, relPath: base ? `${base}/${f.name}` : f.name });
      }
    } else if (entry.isDirectory){
      const reader = entry.createReader();
      const entries = await new Promise(res => reader.readEntries(res));
      for (const en of entries){ await traverse(en, base ? `${base}/${entry.name}` : entry.name); }
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

/* ========================= Helpers comuni ============================= */
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
function canvasToBlob(canvas, mime, q=0.85){ return new Promise(res => canvas.toBlob(res, mime, q)); }

/* =============================== Immagini (Sito) ====================== */
const TxtSlugIta = $('#TxtSlugIta');
const TxtSlugEng = $('#TxtSlugEng');
const Fmt1920 = $('#FmtSite1920');
const FmtShare= $('#FmtSiteShare');
const FmtCustom=$('#FmtSiteCustom');
const CustomRow=$('#CustomSizeRow');
const CustomW = $('#CustomW');
const CustomH = $('#CustomH');

function toggleCustomRow(){ FmtCustom.checked ? showEl(CustomRow) : hideEl(CustomRow); }
[Fmt1920, FmtShare, FmtCustom].forEach(r => r?.addEventListener('change', toggleCustomRow));
toggleCustomRow();
function getSelectedFormat(){
  if (FmtCustom.checked){
    return { w: Math.max(1, Number(CustomW.value) || 1920), h: Math.max(1, Number(CustomH.value) || 1080) };
  }
  if (FmtShare.checked) return { w:1200, h:630 };
  return { w:1920, h:1080 };
}

async function loadFolderMap(){
  try {
    const res = await fetch('./assets/folder_map.csv', { cache:'no-store' });
    if (!res.ok) return {};
    const txt = await res.text();
    const rows = txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if (!rows.length) return {};
    const header= rows[0].split(',').map(h=>h.trim().toLowerCase());
    const iITA = header.findIndex(h => ['ita','it'].includes(h));
    const iENG = header.findIndex(h => ['eng','en'].includes(h));
    if (iITA<0 || iENG<0) return {};
    const map = {};
    for (let i=1; i<rows.length; i++){
      const cols = rows[i].split(',');
      const ita = (cols[iITA]||'').trim().toLowerCase();
      const eng = (cols[iENG]||'').trim();
      if (ita && eng) map[ita] = eng;
    }
    return map;
  } catch { return {}; }
}
function drawCoverToCanvas(bmp, W, H){
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const scale = Math.max(W/bmp.width, H/bmp.height);
  const dw = Math.round(bmp.width * scale);
  const dh = Math.round(bmp.height * scale);
  const dx = Math.round((W - dw) / 2);
  const dy = Math.round((H - dh) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, dx, dy, dw, dh);
  return c;
}

async function exportImages(){
  const slugIta = slugify(TxtSlugIta.value);
  const slugEng = slugify(TxtSlugEng.value);
  if (!slugIta || !slugEng){ alert("Compila i campi ITA e ENG."); return; }

  const images = picked.filter(p => /\.(jpe?g|png|tif?f)$/i.test(p.file.name));
  if (!images.length){ alert("Carica una cartella con immagini."); return; }

  const { w:W, h:H } = getSelectedFormat();
  const folderMap = await loadFolderMap();

  const groups = new Map();
  for (const rec of images){
    const p = rec.relPath || rec.file.name;
    const folder = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(rec);
  }

  const zip = new JSZip();
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = "Esportazione in corso…";
  const total = images.length; let processed = 0;

  for (const [relFolder, recs] of groups){
    let leaf = "";
    if (relFolder){
      const parts = relFolder.split('/').filter(Boolean);
      leaf = parts.length ? parts[parts.length-1] : '';
    }
    const leafIta = leaf || 'hero';
    const leafEng = folderMap[leafIta] || leafIta;
    const slugFolderIta = slugify(leafIta);
    const slugFolderEng = slugify(leafEng);

    recs.sort((a,b)=> (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true }));

    let counter = 0;
    for (const rec of recs){
      counter++;
      const nn = String(counter).padStart(2,'0');
      const baseIta = slugIta + (slugFolderIta ? `-${slugFolderIta}` : '');
      const baseEng = slugEng + (slugFolderEng ? `-${slugFolderEng}` : '');
      const outIta = `${baseIta}-${nn}`;
      const outEng = `${baseEng}-${nn}`;
      const bmp = await loadImageBitmap(rec.file);
      const canvas = drawCoverToCanvas(bmp, W, H);
      const webp = await canvasToBlob(canvas, 'image/webp', 0.85);
      const jpg  = await canvasToBlob(canvas, 'image/jpeg', 0.85);
      zip.file(`_EXPORT_SITO/ITA/WEBP/${outIta}.webp`, webp);
      zip.file(`_EXPORT_SITO/ITA/JPG/${outIta}.jpg`,  jpg);
      zip.file(`_EXPORT_SITO/ENG/WEBP/${outEng}.webp`, webp);
      zip.file(`_EXPORT_SITO/ENG/JPG/${outEng}.jpg`,  jpg);
      ActionProgress.value = Math.round((++processed/total)*100);
    }
  }

  const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `EXPORT_SITO-${slugIta}-${stamp}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
  hideEl(ActionProgressWrap);
}

/* ============================== DigitalTool =========================== */
function makeCanvasFromRules(bmp){
  const w=bmp.width, h=bmp.height, ratio=w/h;
  const square = Math.abs(ratio-1) <= 0.03;
  if (square){
    const W=2000, H=2000;
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    const scale=Math.max(W/w, H/h);
    const dw=Math.round(w*scale), dh=Math.round(h*scale);
    const dx=Math.round((W-dw)/2), dy=Math.round((H-dh)/2);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(bmp, dx, dy, dw, dh);
    return c;
  }
  if (w>=h){
    const W=2500; const H=Math.round(h*(W/w));
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(bmp,0,0,W,H);
    return c;
  }
  {
    const H=2000; const W=Math.round(w*(H/h));
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(bmp,0,0,W,H);
    return c;
  }
}
async function toBlobCapped(canvas, mime){
  const ladder=[0.85,0.75,0.65,0.50,0.40];
  for (const q of ladder){
    const b = await new Promise(res=>canvas.toBlob(res,mime,q));
    if (!b) continue;
    if (b.size <= 450*1024) return b;
    if (q===ladder[ladder.length-1]) return b;
  }
}
async function exportDigitalTool(){
  const images = picked.filter(p => /\.(jpe?g|png|tif?f)$/i.test(p.file.name));
  if (!images.length){ alert("Carica immagini."); return; }
  const files = images.sort((a,b)=> (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true }));
  const zip = new JSZip();
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = "Esportazione in corso…";
  const countsByFolder = new Map();
  const total = files.length; let processed = 0;
  for (const rec of files){
    const p = rec.relPath || rec.file.name;
    const relFolder = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
    const current = countsByFolder.get(relFolder) || 0;
    const nn = String(current+1).padStart(2,'0');
    countsByFolder.set(relFolder, current+1);
    const basePathWEBP = `_DIGITALTOOL/${relFolder ? relFolder + '/' : ''}WEBP/`;
    const basePathJPG  = `_DIGITALTOOL/${relFolder ? relFolder + '/' : ''}JPG/`;
    const bmp = await loadImageBitmap(rec.file);
    const canvas = makeCanvasFromRules(bmp);
    const webp = await toBlobCapped(canvas,'image/webp');
    const jpg  = await toBlobCapped(canvas,'image/jpeg');
    if (webp) zip.file(`${basePathWEBP}${nn}.webp`, webp);
    if (jpg)  zip.file(`${basePathJPG}${nn}.jpg`,  jpg);
    ActionProgress.value = Math.round((++processed/total)*100);
  }
  const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `DIGITALTOOL-${stamp}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
  hideEl(ActionProgressWrap);
}

/* ============================== PDF → JPG ============================= */
async function ensurePdfJs(){
  if (window.pdfjsLib) return;
  await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload=resolve; s.onerror=reject;
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}
async function exportPdfToJpg(){
  const pdfs = picked.filter(p => /\.pdf$/i.test(p.file.name));
  if (!pdfs.length){ alert("Carica PDF."); return; }
  await ensurePdfJs();
  const zip = new JSZip();
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = "Esportazione in corso…";
  const TARGET = 1.5 * 1024 * 1024;
  const total = pdfs.length; let processed = 0;
  for (const rec of pdfs){
    const file = rec.file;
    const relPath = rec.relPath || rec.file.name;
    const relFolder = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '';
    const baseName  = file.name.replace(/\.pdf$/i,'');
    const prefixDir = `_EXPORT_PDF2JPG/${relFolder ? relFolder + '/' : ''}`;
    const ab = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({data:ab}).promise;
    for (let pageNum=1; pageNum<=pdf.numPages; pageNum++){
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale:300/72 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext:ctx, viewport }).promise;
      let blob = await canvasToBlob(canvas, 'image/jpeg', 0.95);
      if (blob.size > TARGET){
        const ladder=[0.90,0.85,0.80,0.75];
        for (const q of ladder){
          const b = await canvasToBlob(canvas,'image/jpeg',q);
          blob = b; if (b.size <= TARGET) break;
        }
      }
      const suffix = pdf.numPages>1 ? `-${String(pageNum).padStart(2,'0')}` : '';
      zip.file(`${prefixDir}${baseName}${suffix}.jpg`, blob);
    }
    ActionProgress.value = Math.round((++processed/total)*100);
  }
  const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `EXPORT_PDF2JPG-${stamp}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
  hideEl(ActionProgressWrap);
}

/* ================================ Rename ============================== */
const TxtRenameBase = $('#TxtRenameBase');
async function exportRename(){
  const base = slugify(TxtRenameBase?.value || "").trim();
  const mode = base ? 2 : 1;
  const files = pickedRename.filter(p => /\.(jpe?g|png|tif?f|webp)$/i.test(p.file.name));
  if (!files.length){ alert("Carica una cartella per rinominare."); return; }
  const sorted = files.sort((a,b)=> (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true }));
  const zip = new JSZip();
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = "Esportazione in corso…";
  const total = sorted.length;
  for (let i=0; i<sorted.length; i++){
    const rec = sorted[i];
    const file = rec.file;
    const ext = "." + file.name.split(".").pop().toLowerCase();
    const nn = String(i+1).padStart(2,'0');
    const newName = (mode === 1) ? `${nn}${ext}` : `${base}-${nn}${ext}`;
    zip.file(newName, file);
    ActionProgress.value = Math.round(((i+1)/total)*100);
  }
  const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `RENAME-${stamp}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
  hideEl(ActionProgressWrap);
}

/* ============================= VIDEO: Slideshow ======================= */
const VidTitle    = $('#VidTitle');
const VidDuration = $('#VidDuration');
const VidFmtH     = $('#VidFmtH');
const VidFmtV     = $('#VidFmtV');
const VidFmtS     = $('#VidFmtS');
const DropAreaVideo = $('#DropAreaVideo');
const TxtFolderVideo = $('#TxtFolderVideo');
const BtnClearVideo  = $('#BtnClearVideo');
const VidCanvas = $('#VidCanvas');

if (DropAreaVideo) {
  const preventV = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => DropAreaVideo.addEventListener(ev, preventV));
  DropAreaVideo.addEventListener('dragenter', ()=> DropAreaVideo.classList.add('drag-over'));
  DropAreaVideo.addEventListener('dragleave', ()=> DropAreaVideo.classList.remove('drag-over'));
  DropAreaVideo.addEventListener('drop', async (e)=>{
    DropAreaVideo.classList.remove('drag-over');
    const all = await readDroppedDirectory(e.dataTransfer);
    pickedVideo = all
      .filter(p => /\.(jpe?g|png|tif?f|webp)$/i.test(p.file.name))
      .sort((a,b)=> (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true }));
    TxtFolderVideo.textContent = pickedVideo.length
      ? `Selezionati ${pickedVideo.length} file…`
      : 'Nessun file supportato.';
    BtnClearVideo.classList.toggle('hidden', pickedVideo.length === 0);
  });
  DropAreaVideo.addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file'; input.webkitdirectory = true; input.multiple = true; input.accept = 'image/*';
    input.onchange = ()=>{
      const fl = input.files ? Array.from(input.files) : [];
      pickedVideo = fl
        .filter(f => /\.(jpe?g|png|tif?f|webp)$/i.test(f.name))
        .map(f => ({ file:f, relPath:f.webkitRelativePath || f.name }))
        .sort((a,b)=> (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true }));
      TxtFolderVideo.textContent = pickedVideo.length
        ? `Selezionati ${pickedVideo.length} file…`
        : 'Nessun file supportato.';
      BtnClearVideo.classList.toggle('hidden', pickedVideo.length === 0);
    };
    input.click();
  });
  BtnClearVideo?.addEventListener('click', (e)=>{
    e.stopPropagation();
    pickedVideo = [];
    TxtFolderVideo.textContent = 'Trascina qui la cartella…';
    BtnClearVideo.classList.add('hidden');
  });
}
function computeStill(T, N, F){
  let still = (T - (N - 1) * F) / N;
  if (still <= 0){ F = Math.max(0, (T / Math.max(1, N - 1)) * 0.35); still = Math.max(0.3, (T - (N - 1) * F) / N); }
  return { still, fade: F };
}
function buildTimelineVideo(N, T, F, fps){
  const { still, fade } = computeStill(T, N, F);
  const frames = Math.round(T * fps);
  const seg = [];
  for (let i=0;i<N;i++) seg.push(i < N-1 ? (still + fade) : still);
  const offsets = [0];
  for (let i=1;i<N;i++) offsets[i] = offsets[i-1] + seg[i-1];
  return { still, fade, offsets, frames };
}
function drawCoverOn(ctx, bmp, W, H){
  const iw=bmp.width, ih=bmp.height;
  const cr=W/H, ir=iw/ih;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  let dw,dh,dx,dy;
  if (ir > cr) { dh=H; dw=Math.round(dh*ir); dx=Math.round((W-dw)/2); dy=0; }
  else { dw=W; dh=Math.round(dw/ir); dx=0; dy=Math.round((H-dh)/2); }
  ctx.drawImage(bmp, dx, dy, dw, dh);
}
function renderAt(tl, items, W, H, tSec){
  const { still, fade, offsets } = tl;
  const ctx = VidCanvas.getContext('2d', { alpha:false });
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
  let i=0;
  for (; i<items.length; i++){
    const start = offsets[i];
    const segDur = (i < items.length-1 ? (still + fade) : still);
    if (tSec < start + segDur || i === items.length-1) break;
  }
  const start = offsets[i];
  const localT = tSec - start;
  const cur = items[i].bmp;
  if (i < items.length-1 && localT > still){
    const alpha = Math.min(1, (localT - still)/fade);
    ctx.globalAlpha = 1; drawCoverOn(ctx, cur, W, H);
    ctx.globalAlpha = alpha; drawCoverOn(ctx, items[i+1].bmp, W, H);
    ctx.globalAlpha = 1;
  } else {
    drawCoverOn(ctx, cur, W, H);
  }
}
async function filesToBitmapsVideo(recs){
  const arr = [];
  for (const r of recs){ arr.push({ name:r.file.name, bmp: await loadImageBitmap(r.file) }); }
  return arr;
}
function pickVideoSize(){
  if (VidFmtV?.checked) return { W:1080, H:1920 };
  if (VidFmtS?.checked) return { W:1080, H:1080 };
  return { W:1920, H:1080 };
}
function pickBitrate(W,H,fps){
  const isSquare = (W===1080 && H===1080);
  let bps = isSquare ? 8e6 : 12e6;
  if (fps > 30) bps = Math.round(bps * (fps/30));
  return bps;
}
function supportsMp4Recorder(){
  if (!('MediaRecorder' in window)) return null;
  const c=[
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4'
  ];
  for (const m of c){
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {}
  }
  return null;
}
async function supportsH264WebCodecs(){
  if (!('VideoEncoder' in window)) return null;
  try {
    const test = await VideoEncoder.isConfigSupported({ codec: 'avc1.42E01E', width:1080, height:1080, framerate:30, hardwareAcceleration:'prefer-hardware' });
    return test.supported ? test.config : null;
  } catch { return null; }
}
async function exportWithWebCodecsMP4(items, {T,F,fps,W,H,bitrate}){
  if (!window.MP4Box) throw new Error('MP4Box.js non caricato');
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = 'Esportazione in corso…';
  VidCanvas.width = W; VidCanvas.height = H;
  const tl = buildTimelineVideo(items.length, T, F, fps);
  const cfg = await supportsH264WebCodecs();
  if (!cfg) throw new Error('H.264 WebCodecs non disponibile');
  const encConfig = { ...cfg, width:W, height:H, framerate:fps, bitrate, bitrateMode:'constant', avc:{ format:'annexb' } };
  const mp4 = MP4Box.createFile();
  const chunks = [];
  const segCtx = { nextFileStart: 0 };
  mp4.onSegment = (id, user, buffer) => { buffer.fileStart = user.nextFileStart; user.nextFileStart += buffer.byteLength; chunks.push(buffer); };
  let trackId = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const ts = chunk.timestamp;
      const dur = chunk.duration || Math.round(1e6 / fps);
      const key = (chunk.type === 'key');
      const buf = new Uint8Array(chunk.byteLength); chunk.copyTo(buf);
      if (!trackId && meta?.decoderConfig?.description){
        trackId = mp4.addTrack({ timescale: 1e6, width: W, height: H, h264: { avcDecoderConfigRecord: meta.decoderConfig.description } });
        mp4.setSegmentOptions(trackId, segCtx, { nbSamples: 1e6 });
        const inits = mp4.initializeSegmentation();
        inits.forEach(seg => { seg.buffer.fileStart = segCtx.nextFileStart; segCtx.nextFileStart += seg.buffer.byteLength; chunks.push(seg.buffer); });
      }
      mp4.addSample(trackId, buf.buffer, { dts:ts, cts:ts, duration:dur, is_sync:key });
    }, error: e => console.error(e)
  });
  encoder.configure(encConfig);
  const total = tl.frames;
  const frameDurUs = Math.round(1e6 / fps);
  for (let f=0; f<total; f++){
    renderAt(tl, items, W, H, f / fps);
    const vf = new VideoFrame(VidCanvas, { timestamp: f * frameDurUs });
    encoder.encode(vf, { keyFrame: (f===0) || (f % (fps*2) === 0) });
    vf.close();
    if ((f % fps) === 0){
      ActionProgress.value = Math.round((f/total)*100);
      await new Promise(r => setTimeout(r));
    }
  }
  await encoder.flush();
  encoder.close();
  mp4.flush();
  hideEl(ActionProgressWrap);
  return new Blob(chunks, { type:'video/mp4' });
}
async function exportWithMediaRecorder(items, {T,F,fps,W,H,mime,bitrate}){
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = 'Esportazione in corso…';
  VidCanvas.width = W; VidCanvas.height = H;
  const tl = buildTimelineVideo(items.length, T, F, fps);
  const str = VidCanvas.captureStream(fps);
  const rec = new MediaRecorder(str, { mimeType: mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: 128000 });
  const parts = [];
  rec.ondataavailable = e => { if (e.data?.size) parts.push(e.data); };
  const stopped = new Promise(res => rec.onstop = res);
  rec.start(Math.min(1000, Math.round(1000/fps)));
  const t0 = performance.now(); let rafId = 0;
  (function loop(){
    const now = performance.now();
    const tSec = Math.min((now - t0)/1000, T);
    renderAt(tl, items, W, H, tSec);
    ActionProgress.value = Math.min(100, Math.round((tSec/T)*100));
    if (tSec < T) rafId = requestAnimationFrame(loop);
  })();
  await new Promise(r => setTimeout(r, Math.max(0, T*1000)));
  rec.stop();
  if (rafId) cancelAnimationFrame(rafId);
  await stopped;
  hideEl(ActionProgressWrap);
  return new Blob(parts, { type: mime });
}
async function exportVideoSlideshow(){
  const title = (VidTitle?.value || '').trim();
  if (!title){ alert('Inserisci “Nome video”.'); return; }
  if (!pickedVideo.length){ alert('Carica una cartella con immagini.'); return; }
  const T = parseFloat(VidDuration.value);
  const F = 1.0;  const fps = 30;
  const { W, H } = pickVideoSize(); const bitrate = pickBitrate(W,H,fps);
  const items = await filesToBitmapsVideo(pickedVideo);
  const h264Cfg = await supportsH264WebCodecs(); const mp4Mime = supportsMp4Recorder();
  let blob, filename;
  if (h264Cfg && window.MP4Box){ blob = await exportWithWebCodecsMP4(items, {T,F,fps,W,H,bitrate}); filename = `${slugify(title)}.mp4`; }
  else if (mp4Mime){ blob = await exportWithMediaRecorder(items, {T,F,fps,W,H,mime:mp4Mime,bitrate}); filename = `${slugify(title)}.mp4`; }
  else { const webmMime = (window.MediaRecorder && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8';
    blob = await exportWithMediaRecorder(items, {T,F,fps,W,H,mime:webmMime,bitrate}); filename = `${slugify(title)}.webm`; }
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download= filename; a.click(); URL.revokeObjectURL(url);
}

/* ========================= WATERMARK (auto) =========================== */
const DropAreaLogo = $('#DropAreaLogo');
const TxtLogoName  = $('#TxtLogoName');
const BtnClearLogo = $('#BtnClearLogo');
let customLogoFile = null;

if (DropAreaLogo){
  const stop = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => DropAreaLogo.addEventListener(ev, stop));
  DropAreaLogo.addEventListener('dragenter', ()=> DropAreaLogo.classList.add('drag-over'));
  DropAreaLogo.addEventListener('dragleave', ()=> DropAreaLogo.classList.remove('drag-over'));
  DropAreaLogo.addEventListener('drop', (e)=>{
    DropAreaLogo.classList.remove('drag-over');
    const f = e.dataTransfer?.files?.[0]; if (!f) return;
    customLogoFile = f; if (TxtLogoName) TxtLogoName.textContent = f.name; BtnClearLogo?.classList.remove('hidden');
  });
  DropAreaLogo.addEventListener('click', ()=>{
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = ()=>{ const f = inp.files?.[0]; if (!f) return; customLogoFile = f; if (TxtLogoName) TxtLogoName.textContent = f.name; BtnClearLogo?.classList.remove('hidden'); };
    inp.click();
  });
  BtnClearLogo?.addEventListener('click', (e)=>{
    e.stopPropagation(); customLogoFile = null;
    if (TxtLogoName) TxtLogoName.textContent = 'Trascina qui il logo o clicca per sfogliare… (PNG trasparente)';
    BtnClearLogo?.classList.add('hidden');
  });
}
async function loadLogoForWatermark(file){
  if (file) return await createImageBitmap(file, { imageOrientation:'from-image' });
  const candidates = ['./assets/logo-watermark.png','./assets/logo.png'];
  for (const url of candidates){
    try {
      const res = await fetch(url, { cache:'no-store' });
      if (res.ok) return await createImageBitmap(await res.blob(), { imageOrientation:'from-image' });
    } catch {}
  }
  return null;
}
function drawFitToCanvas(bmp, W=1024, H=768, mode='contain'){
  const c = document.createElement('canvas'); c.width=W; c.height=H;
  const ctx = c.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  const sContain = Math.min(W/bmp.width, H/bmp.height);
  const sCover   = Math.max(W/bmp.width, H/bmp.height);
  const scale = (mode === 'cover') ? sCover : sContain;
  const dw = Math.round(bmp.width  * scale);
  const dh = Math.round(bmp.height * scale);
  const dx = Math.round((W - dw)/2);
  const dy = Math.round((H - dh)/2);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality='high';
  ctx.drawImage(bmp, dx, dy, dw, dh);
  return c;
}
function drawLogoCenter(c, logoBmp){
  if (!logoBmp) return;
  const ctx = c.getContext('2d'), W = c.width, H = c.height;
  const maxSide = Math.min(W, H) * 0.35;
  const lr = logoBmp.width / logoBmp.height;
  const lw = lr >= 1 ? maxSide : Math.round(maxSide * lr);
  const lh = lr >= 1 ? Math.round(lw / lr) : maxSide;
  const x = Math.round((W - lw)/2), y = Math.round((H - lh)/2);
  ctx.drawImage(logoBmp, x, y, lw, lh);
}
async function exportWatermarkPortali(){
  const images = picked.filter(p => /\.(jpe?g|png|tif?f|webp)$/i.test(p.file.name));
  const pdfs   = picked.filter(p => /\.pdf$/i.test(p.file.name));
  if (!images.length && !pdfs.length){ alert('Carica immagini o PDF.'); return; }

  const logo = await loadLogoForWatermark(customLogoFile);
  const zip = new JSZip();
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = 'Elaborazione…';
  const total = images.length + pdfs.length; let done = 0;

  // IMMAGINI → cover
  let counterImg = 0;
  for (const rec of images){
    const bmp = await loadImageBitmap(rec.file);
    const c = drawFitToCanvas(bmp, 1024, 768, 'cover');
    drawLogoCenter(c, logo);
    const jpg = await canvasToBlob(c,'image/jpeg',0.92);
    const nn = String(++counterImg).padStart(2,'0');
    zip.file(`_EXPORT_WATERMARK/immagini/immagini-${nn}.jpg`, jpg);
    ActionProgress.value = Math.round((++done/total)*100);
  }

  // PDF (A3) → contain
  if (pdfs.length){
    await ensurePdfJs();
    for (const rec of pdfs){
      const ab = await rec.file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({data:ab}).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 300/72 });
      const tmp = document.createElement('canvas');
      tmp.width  = Math.ceil(viewport.width);
      tmp.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: tmp.getContext('2d'), viewport }).promise;
      const bmp = await createImageBitmap(tmp);
      const c = drawFitToCanvas(bmp, 1024, 768, 'contain');
      drawLogoCenter(c, logo);
      const jpg = await canvasToBlob(c,'image/jpeg',0.92);
      const base = rec.file.name.replace(/\.pdf$/i,'');
      zip.file(`_EXPORT_WATERMARK/planimetria/${base}.jpg`, jpg);
      ActionProgress.value = Math.round((++done/total)*100);
    }
  }

  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `EXPORT_WATERMARK-${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
  hideEl(ActionProgressWrap);
}

/* ========================= BIGLIETTO DA VISITA (Akrobat/Calibri) ===== */
const BvBrandPills = $('#BvBrandPills');
const BvForm       = $('#BvForm');
const BvFullName   = $('#BvFullName');
const BvJobTitle   = $('#BvJobTitle');
const BvPhone      = $('#BvPhone');
const BvEmail      = $('#BvEmail');
const BvReaWrap    = $('#BvReaWrap');   // checkbox container
const BvReaInput   = $('#BvReaInput');  // input container (hidden)
const BvHasRea     = $('#BvHasRea');
const BvRea        = $('#BvRea');

let bvBrand = null; // 'abitareco' | 'commercial' | 'riabitareco'

// UI: brand / REA
BvBrandPills?.addEventListener('click', (e) => {
  const btn = e.target.closest('.brand-pill'); if (!btn) return;
  $$('.brand-pill').forEach(p => p.classList.toggle('active', p === btn));
  bvBrand = btn.dataset.brand;
  showEl(BvForm);

  if (bvBrand === 'abitareco') {
    showEl(BvReaWrap);
    (BvHasRea?.checked) ? showEl(BvReaInput) : hideEl(BvReaInput);
  } else {
    hideEl(BvReaWrap); hideEl(BvReaInput);
    if (BvHasRea) BvHasRea.checked = false;
    if (BvRea)    BvRea.value = '';
  }
});
BvHasRea?.addEventListener('change', ()=>{
  if (bvBrand !== 'abitareco') return;
  (BvHasRea.checked) ? showEl(BvReaInput) : (hideEl(BvReaInput), BvRea && (BvRea.value=''));
});

// Font helpers (brand -> Akrobat / Calibri)
async function fetchFirst(paths){
  for (const p of paths){
    try {
      const res = await fetch(p, { cache:'no-store' });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch {}
  }
  return null;
}
async function ensureFontkit(pdfDoc){
  if (!window.fontkit) {
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://unpkg.com/@pdf-lib/fontkit@1.0.0/dist/fontkit.umd.min.js';
      s.onload=resolve; s.onerror=reject;
      document.head.appendChild(s);
    });
  }
  pdfDoc.registerFontkit(window.fontkit);
}
async function loadBrandFontsForBV(pdfDoc, brand) {
  await ensureFontkit(pdfDoc);

  let regCandidates = [];
  let boldCandidates = [];

  if (brand === 'riabitareco') {
    // Calibri (dallo screenshot: calibri.ttf, calibrib.ttf, calibriz.ttf…)
    regCandidates = [
      'assets/fonts/bv/calibri.ttf',
      'assets/fonts/bv/Calibri.ttf',
      'assets/fonts/bv/Calibri-Regular.ttf',
      'assets/fonts/bv/Calibri Regular.ttf'
    ];
    boldCandidates = [
      'assets/fonts/bv/calibrib.ttf',
      'assets/fonts/bv/Calibri-Bold.ttf',
      'assets/fonts/bv/Calibri Bold.ttf',
      'assets/fonts/bv/CalibriBold.ttf'
    ];
  } else {
    // Akrobat
    regCandidates = [
      'assets/fonts/bv/Akrobat-Regular.otf',
      'assets/fonts/bv/Akrobat-Regular.ttf',
      'assets/fonts/bv/Akrobat Regular.ttf'
    ];
    boldCandidates = [
      'assets/fonts/bv/Akrobat-Bold.otf',
      'assets/fonts/bv/Akrobat-Bold.ttf',
      'assets/fonts/bv/Akrobat Bold.ttf'
    ];
  }

  const regBytes  = await fetchFirst(regCandidates);
  const boldBytes = await fetchFirst(boldCandidates);

  let fontReg = null, fontBold = null;
  try { if (regBytes)  fontReg  = await pdfDoc.embedFont(regBytes); }  catch {}
  try { if (boldBytes) fontBold = await pdfDoc.embedFont(boldBytes); } catch {}

  return { fontReg, fontBold };
}

async function exportBusinessCard(){
  if (!bvBrand) { alert('Seleziona un brand (Abitare Co. / Abitare Commercial / RiAbitare Co.).'); return; }
  const fullName = (BvFullName?.value || '').trim();
  const jobTitle = (BvJobTitle?.value || '').trim();
  const phone    = (BvPhone?.value    || '').trim();
  const email    = (BvEmail?.value    || '').trim();
  if (!fullName || !jobTitle || !phone || !email) { alert('Compila tutti i campi obbligatori.'); return; }
  const wantsRea = (bvBrand === 'abitareco') && (BvHasRea?.checked);
  const reaCode  = (wantsRea ? (BvRea?.value || '').trim() : '');

  const tpl = {
    abitareco: {
      front: 'assets/templates/businesscard/abitareco/front.pdf',
      backNoRea: 'assets/templates/businesscard/abitareco/back_form.pdf',
      backRea:   'assets/templates/businesscard/abitareco/back_rea_form.pdf',
      nameMode: 'NoBrand'
    },
    commercial: {
      front: 'assets/templates/businesscard/commercial/front.pdf',
      backNoRea: 'assets/templates/businesscard/commercial/back_form.pdf',
      backRea: null,
      nameMode: 'WithBrand'
    },
    riabitareco: {
      front: 'assets/templates/businesscard/riabitareco/front.pdf',
      backNoRea: 'assets/templates/businesscard/riabitareco/back_form.pdf',
      backRea: null,
      nameMode: 'WithBrand'
    }
  }[bvBrand];

  // Back compilato + font brand
  const backTplUrl = (wantsRea && tpl.backRea) ? tpl.backRea : tpl.backNoRea;
  const backTplBytes = await (await fetch(backTplUrl, { cache:'no-store' })).arrayBuffer();
  let backDoc = await PDFLib.PDFDocument.load(backTplBytes);

  const { fontReg, fontBold } = await loadBrandFontsForBV(backDoc, bvBrand);

  const form = backDoc.getForm();
  try { const f=form.getTextField('FullName'); f.setText(fullName); (fontBold||fontReg)&&f.updateAppearances(fontBold||fontReg); } catch {}
  try { const f=form.getTextField('JobTitle'); f.setText(jobTitle); (fontReg||fontBold)&&f.updateAppearances(fontReg||fontBold); } catch {}
  try { const f=form.getTextField('Phone');    f.setText(phone);    (fontReg||fontBold)&&f.updateAppearances(fontReg||fontBold); } catch {}
  try { const f=form.getTextField('Email');    f.setText(email);    (fontReg||fontBold)&&f.updateAppearances(fontReg||fontBold); } catch {}
  if (wantsRea && tpl.backRea){
    try { const f=form.getTextField('ReaCode'); f.setText(reaCode); (fontReg||fontBold)&&f.updateAppearances(fontReg||fontBold); } catch {}
  }
  form.flatten();
  const backFilledBytes = await backDoc.save();

  // Front
  const frontBytes = new Uint8Array(await (await fetch(tpl.front, { cache:'no-store' })).arrayBuffer());
  const frontDoc = await PDFLib.PDFDocument.load(frontBytes);

  // Merge (front -> back)
  const finalDoc = await PDFLib.PDFDocument.create();
  const [frontPg] = await finalDoc.copyPages(frontDoc, [0]);
  finalDoc.addPage(frontPg);
  const backFilledDoc = await PDFLib.PDFDocument.load(backFilledBytes);
  const [backPg] = await finalDoc.copyPages(backFilledDoc, [0]);
  finalDoc.addPage(backPg);

  const out = await finalDoc.save();

  // Filename
  const safe = fullName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'biglietto';
  const fileName = (tpl.nameMode === 'WithBrand') ? `BV-${bvBrand}-${safe}.pdf` : `BV-${safe}.pdf`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out], {type:'application/pdf'}));
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* =============================== QR + UTM ============================= */
const QrBase = $('#QrBase');
const QrSource = $('#QrSource');
const QrMedium = $('#QrMedium');
const QrCampaign = $('#QrCampaign');
const QrId = $('#QrId');
const QrTerm = $('#QrTerm');
const QrContent = $('#QrContent');
const QrGeneratedUrl = $('#QrGeneratedUrl');
const QrCopyUrl = $('#QrCopyUrl');
// Non mostriamo anteprima: teniamo i riferimenti ma li nascondiamo.
const QrCanvas = $('#QrCanvas');
const QrPreviewWrap = $('#QrPreviewWrap');
const QrDownloadPng = $('#QrDownloadPng');
const QrDownloadSvg = $('#QrDownloadSvg');

function isValidHttpUrl(str){
  try {
    const u = new URL(str);
    return (u.protocol === 'http:' || u.protocol === 'https:');
  } catch {
    return false;
  }
}

function buildUtmUrl(){
  const base = (QrBase?.value || '').trim();
  if (!base) return '';
  try {
    const u = new URL(base);
    const set = (k, el) => {
      const v = (el?.value || '').trim();
      if (v) u.searchParams.set(k, v);
      else u.searchParams.delete(k);
    };
    set('utm_source', QrSource);
    set('utm_medium', QrMedium);
    set('utm_campaign', QrCampaign);
    set('utm_id', QrId);
    set('utm_term', QrTerm);
    set('utm_content', QrContent);
    return u.toString();
  } catch {
    return '';
  }
}

function validateQrInputs(){
  const base = (QrBase?.value || '').trim();
  const src = (QrSource?.value || '').trim();
  const med = (QrMedium?.value || '').trim();
  const camp = (QrCampaign?.value || '').trim();

  if (!base) return { ok:false, msg:'Compila Website URL.' };
  if (!isValidHttpUrl(base)) return { ok:false, msg:'Website URL deve iniziare con http:// o https://'};
  if (!src) return { ok:false, msg:'Compila Campaign source (utm_source).'};
  if (!med) return { ok:false, msg:'Compila Campaign medium (utm_medium).'};
  if (!camp) return { ok:false, msg:'Compila Campaign name (utm_campaign).'};

  const built = buildUtmUrl();
  if (!built || !isValidHttpUrl(built)) return { ok:false, msg:'URL generata non valida. Controlla i campi.' };
  return { ok:true, url: built };
}

function hideQrUIExtras(){
  if (QrPreviewWrap) QrPreviewWrap.classList.add('hidden');
  if (QrDownloadPng) { QrDownloadPng.classList.add('hidden'); QrDownloadPng.removeAttribute('href'); }
  if (QrDownloadSvg) { QrDownloadSvg.classList.add('hidden'); QrDownloadSvg.removeAttribute('href'); }
}

function safeDownloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 2000);
}

async function ensureQrLib(){
  // Useremo qrcodejs (https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js)
  // che espone window.QRCode come costruttore.
  if (typeof window.QRCode === 'function' && window.QRCode.CorrectLevel) return;
  throw new Error('Libreria QRCode non disponibile (qrcodejs non caricata).');
}

function canvasToEmbeddedSvg(canvas){
  // SVG che contiene l'immagine PNG incorporata (compatibile e leggero)
  const pngDataUrl = canvas.toDataURL('image/png');
  const w = canvas.width, h = canvas.height;
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
         `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
         `<image href="${pngDataUrl}" width="${w}" height="${h}"/>` +
         `</svg>\n`;
}

function updateQrGeneratedUrl(){
  const url = buildUtmUrl();
  if (QrGeneratedUrl) QrGeneratedUrl.value = url || '';
  if (QrCopyUrl) QrCopyUrl.disabled = !url;

  if (currentMode === 'qr' && BtnProcedi){
    const v = validateQrInputs();
    BtnProcedi.disabled = !v.ok;
  }
  hideQrUIExtras();
}

async function makeQr(){
  try {
    const v = validateQrInputs();
    if (!v.ok){ alert(v.msg); return; }
    const url = v.url;
    if (QrGeneratedUrl) QrGeneratedUrl.value = url;

    await ensureQrLib();

    // Generazione senza preview: creiamo un contenitore offscreen
    const size = 512;
    const wrap = document.createElement('div');
    wrap.style.position = 'fixed';
    wrap.style.left = '-99999px';
    wrap.style.top = '-99999px';
    document.body.appendChild(wrap);

    // qrcodejs scrive canvas o table nel DOM
    const qr = new window.QRCode(wrap, {
      text: url,
      width: size,
      height: size,
      correctLevel: window.QRCode.CorrectLevel.M
    });

    // aspetta che qrcodejs abbia scritto il canvas
    await new Promise(r => setTimeout(r, 0));
    const canvas = wrap.querySelector('canvas');
    if (!canvas) {
      wrap.remove();
      throw new Error('Impossibile generare il QR (canvas non creato).');
    }

    const pngBlob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!pngBlob) { wrap.remove(); throw new Error('Impossibile esportare PNG.'); }

    const svgStr = canvasToEmbeddedSvg(canvas);
    wrap.remove();

    if (!window.JSZip) throw new Error('JSZip non disponibile (CDN).');
    const zip = new JSZip();
    zip.file('qr.png', pngBlob);
    zip.file('qr.svg', svgStr);
    zip.file('url.txt', url + '\n');

    const camp = slugify((QrCampaign?.value || 'qr')) || 'qr';
    const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
    const zipBlob = await zip.generateAsync({ type:'blob' });
    safeDownloadBlob(zipBlob, `QR-${camp}-${stamp}.zip`);
  } catch (err){
    console.error(err);
    alert('Errore durante la generazione del QR: ' + (err?.message || err));
  }
}

QrCopyUrl?.addEventListener('click', async () => {
  const txt = (QrGeneratedUrl?.value || '').trim();
  if (!txt) return;
  try { await navigator.clipboard.writeText(txt); alert('URL copiata negli appunti.'); }
  catch { QrGeneratedUrl?.select(); document.execCommand('copy'); alert('URL copiata (fallback).'); }
});

let __qrDebounce = 0;
function scheduleQrUrlUpdate(){
  if (currentMode !== 'qr') return;
  if (__qrDebounce) clearTimeout(__qrDebounce);
  __qrDebounce = setTimeout(updateQrGeneratedUrl, 150);
}
[QrBase, QrSource, QrMedium, QrCampaign, QrId, QrTerm, QrContent].forEach(el => {
  el?.addEventListener('input', scheduleQrUrlUpdate);
  el?.addEventListener('change', scheduleQrUrlUpdate);
});
/* ================================ IUBENDA ============================= */
const IubSiteId    = $('#IubSiteId');
const IubCookieIt  = $('#IubCookieIt');
const IubCookieEn  = $('#IubCookieEn');
const IubWidgetUrl = $('#IubWidgetUrl');
const IubDualLang  = $('#IubDualLang');
const IubMakeBtn   = $('#IubMakeBtn');
const IubCopyBtn   = $('#IubCopyBtn');
const IubOut       = $('#IubOut');

function makeIubendaSnippet(){
  const siteId = (IubSiteId?.value||'').trim();
  const cpIt   = (IubCookieIt?.value||'').trim();
  const cpEn   = (IubCookieEn?.value||'').trim();
  const widget = (IubWidgetUrl?.value||'//cdn.iubenda.com/cs/iubenda_cs.js').trim();
  if (!siteId || !cpIt) { alert('Compila siteId e cookiePolicyId (IT).'); return; }

  const callback = `
callback: {
  onPreferenceExpressedOrNotNeeded: function (preference) {
    window.dataLayer = window.dataLayer || [];
    dataLayer.push({ event: "cookie_consent_update" });
    if (!preference) { dataLayer.push({ event: "iubenda_preference_not_needed" }); return; }
    if (preference.consent === true)  dataLayer.push({ event: "iubenda_consent_given" });
    if (preference.consent === false) dataLayer.push({ event: "iubenda_consent_rejected" });
  }
}`;

  let snippet;
  if (IubDualLang?.checked && cpEn){
    snippet = `
<script type="text/javascript">
  window.dataLayer = window.dataLayer || [];
  var _iub = _iub || [];
  var pageLang = (document.documentElement.getAttribute("lang")||"").toLowerCase().split("-")[0];
  if (!pageLang) pageLang = (location.pathname.startsWith("/en") ? "en" : "it");
  var cookiePolicyByLang = { it: ${cpIt}, en: ${cpEn} };
  if (!cookiePolicyByLang[pageLang]) pageLang = "it";
  _iub.csConfiguration = {
    siteId: ${siteId},
    cookiePolicyId: cookiePolicyByLang[pageLang],
    lang: pageLang,
    storage: { useSiteId: true },
    ${callback}
  };
</script>
${widget}script>`;
  } else {
    snippet = `
<script type="text/javascript">
  window.dataLayer = window.dataLayer || [];
  var _iub = _iub || [];
  _iub.csConfiguration = {
    siteId: ${siteId},
    cookiePolicyId: ${cpIt},
    lang: "it",
    storage: { useSiteId: true },
    ${callback}
  };
</script>
${widget}script>`;
  }
  if (IubOut) IubOut.value = snippet.trim();
}
IubMakeBtn?.addEventListener('click', makeIubendaSnippet);

IubCopyBtn?.addEventListener('click', async ()=>{
  try { await navigator.clipboard.writeText(IubOut?.value || ''); alert('Snippet copiato negli appunti.'); }
  catch { IubOut?.select(); document.execCommand('copy'); alert('Snippet copiato (fallback).'); }
});

/* -------------------------- Dispatcher globale ------------------------ */
BtnProcedi?.addEventListener('click', async ()=>{
  try {
    BtnProcedi.disabled = true;

    if (currentMode === 'images')     { await exportImages(); return; }
    if (currentMode === 'digitaltool'){ await exportDigitalTool(); return; }
    if (currentMode === 'pdf2jpg')    { await exportPdfToJpg(); return; }
    if (currentMode === 'rename')     { await exportRename(); return; }
    if (currentMode === 'video')      { await exportVideoSlideshow(); return; }
    if (currentMode === 'watermark')  { await exportWatermarkPortali(); return; }
    if (currentMode === 'bv')         { await exportBusinessCard(); return; }

    if (currentMode === 'qr') { await makeQr(); return; }
    alert("Funzione non attiva.");
  } finally {
    BtnProcedi.disabled = false;
  }
});

/* ------------------------------ PPT: download & fonts ----------------- */
window.downloadPPT = (href) => { const a = document.createElement('a'); a.href = href; a.download = href.split('/').pop(); a.click(); };

// ZIP solo dai font PPT (evita i font BV)
const FONTS_LIST = [
  'Manrope-Bold.ttf','Manrope-ExtraBold.ttf','Manrope-ExtraLight.ttf','Manrope-Light.ttf',
  'Manrope-Medium.ttf','Manrope-Regular.ttf','Manrope-SemiBold.ttf',
  'PPPangaia-Bold.otf','PPPangaia-BoldItalic.otf',
  'PPPangaia-Medium.otf','PPPangaia-MediumItalic.otf',
  'PPPangaia-Semibold.otf','PPPangaia-SemiboldItalic.otf',
  'PPPangaia-Ultralight.otf','PPPangaia-UltralightItalic.otf'
];
async function downloadFontsZip(){
  const base = 'assets/fonts/ppt/';
  const zip = new JSZip();
  let added = 0;
  for (const name of FONTS_LIST){
    try {
      const res = await fetch(base + name, { cache:'no-store' });
      if (!res.ok) continue;
      const blob = await res.blob();
      zip.file(name, blob);
      added++;
    } catch {}
  }
  if (!added){ alert('Nessun file font trovato in /assets/fonts/ppt/.'); return; }
  const out = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out);
  a.download = 'abitareco-fonts.zip';
  a.click();
  URL.revokeObjectURL(a.href);
}
$('#BtnFontsZip')?.addEventListener('click', downloadFontsZip);
