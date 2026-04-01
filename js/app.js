/* =========================================================
 Abitare Co. – Digital Content Tool (Web)
 app.js — Immagini + DigitalTool + PDF→JPG + Rename + Video + Watermark (auto) + BV + QR + Iubenda + PPT
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
const PptCard     = $('#PptCard');
const ALL_CARDS = [
  WelcomeCard, SlugCard, FormatCard, UploadCard,
  DTCard, RenameCard, VideoCard, WatermarkCard, BvCard, QrCard, IubCard, PptCard
];

/* ------------------------------- Stato -------------------------------- */
let picked = [];        // Immagini / PDF / Watermark / ecc.
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
      showEl(UploadCard);
      showEl(WatermarkCard);
      break;

    case 'bv':
      showEl(BvCard);
      BtnProcedi.classList.add('hidden'); // azione via bottone dedicato
      break;

    case 'qr':
      showEl(QrCard);
      BtnProcedi.classList.add('hidden');
      break;

    case 'iubenda':
      showEl(IubCard);
      BtnProcedi.classList.add('hidden');
      break;

    case 'ppt':
      showEl(PptCard);
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
  function prevent(e){ e.preventDefault(); e.stopPropagation(); }
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
  function preventR(e){ e.preventDefault(); e.stopPropagation(); }
  ['dragenter','dragover','dragleave','drop'].forEach(ev => DropAreaRename.addEventListener(ev, preventR));
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
  DropAreaRename.addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file'; input.webkitdirectory = true; input.multiple = true;
    input.accept = 'image/*';
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
      for (const en of entries){
        await traverse(en, base ? `${base}/${entry.name}` : entry.name);
      }
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

/* ========================= Helpers Immagini (comuni) ================== */
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
function canvasToBlob(canvas, mime, q=0.85){
  return new Promise(res => canvas.toBlob(res, mime, q));
}

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
    return { w: Math.max(1, Number(CustomW.value) || 1920),
             h: Math.max(1, Number(CustomH.value) || 1080) };
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
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const scale = Math.max(W/bmp.width, H/bmp.height);
  const dw = Math.round(bmp.width * scale);
  const dh = Math.round(bmp.height * scale);
  const dx = Math.round((W - dw) / 2);
  const dy = Math.round((H - dh) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, dx, dy, dw, dh);
  return canvas;
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

    recs.sort((a,b)=>
      (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true })
    );

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
  const files = images.sort((a,b)=>
    (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true })
  );
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
  const sorted = files.sort((a,b)=>
    (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true })
  );
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
// (WebCodecs + MP4Box se disponibili; fallback MediaRecorder)
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
  function preventV(e){ e.preventDefault(); e.stopPropagation(); }
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
function computeStill(T, N, F){ let still = (T - (N - 1) * F) / N;
  if (still <= 0){ F = Math.max(0, (T / Math.max(1, N - 1)) * 0.35); still = Math.max(0.3, (T - (N - 1) * F) / N); }
  return { still, fade: F }; }
function buildTimelineVideo(N, T, F, fps){ const { still, fade } = computeStill(T, N, F);
  const frames = Math.round(T * fps); const seg = []; for (let i=0;i<N;i++) seg.push(i < N-1 ? (still + fade) : still);
  const offsets = [0]; for (let i=1;i<N;i++) offsets[i] = offsets[i-1] + seg[i-1]; return { still, fade, offsets, frames }; }
function drawCoverOn(ctx, bmp, W, H){ const iw=bmp.width, ih=bmp.height; const cr=W/H, ir=iw/ih;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  let dw,dh,dx,dy; if (ir > cr) { dh=H; dw=Math.round(dh*ir); dx=Math.round((W-dw)/2); dy=0; }
  else { dw=W; dh=Math.round(dw/ir); dx=0; dy=Math.round((H-dh)/2); } ctx.drawImage(bmp, dx, dy, dw, dh); }
function renderAt(tl, items, W, H, tSec){ const { still, fade, offsets } = tl; const ctx = VidCanvas.getContext('2d', { alpha:false });
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H); let i=0; for (; i<items.length; i++){
    const start = offsets[i]; const segDur = (i < items.length-1 ? (still + fade) : still); if (tSec < start + segDur || i === items.length-1) break; }
  const start = offsets[i]; const localT = tSec - start; const cur = items[i].bmp;
  if (i < items.length-1 && localT > still){ const alpha = Math.min(1, (localT - still)/fade);
    ctx.globalAlpha = 1; drawCoverOn(ctx, cur, W, H); ctx.globalAlpha = alpha; drawCoverOn(ctx, items[i+1].bmp, W, H); ctx.globalAlpha = 1; }
  else { drawCoverOn(ctx, cur, W, H); } }
async function filesToBitmapsVideo(recs){ const arr = []; for (const r of recs){ arr.push({ name:r.file.name, bmp: await loadImageBitmap(r.file) }); } return arr; }
function pickVideoSize(){ if (VidFmtV?.checked) return { W:1080, H:1920 }; if (VidFmtS?.checked) return { W:1080, H:1080 }; return { W:1920, H:1080 }; }
function pickBitrate(W,H,fps){ const isSquare = (W===1080 && H===1080); let bps = isSquare ? 8e6 : 12e6; if (fps > 30) bps = Math.round(bps * (fps/30)); return bps; }
function supportsMp4Recorder(){ if (!('MediaRecorder' in window)) return null; const c=[
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1.42E01E','video/mp4']; for (const m of c){ try {
    if (MediaRecorder.isTypeSupported(m)) return m; } catch {} } return null; }
async function supportsH264WebCodecs(){ if (!('VideoEncoder' in window)) return null; try {
  const test = await VideoEncoder.isConfigSupported({ codec: 'avc1.42E01E', width:1080, height:1080, framerate:30, hardwareAcceleration:'prefer-hardware' });
  return test.supported ? test.config : null; } catch { return null; } }
async function exportWithWebCodecsMP4(items, {T,F,fps,W,H,bitrate}){
  if (!window.MP4Box) throw new Error('MP4Box.js non caricato');
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = 'Esportazione in corso…';
  VidCanvas.width = W; VidCanvas.height = H;
  const tl = buildTimelineVideo(items.length, T, F, fps);
  const cfg = await supportsH264WebCodecs(); if (!cfg) throw new Error('H.264 WebCodecs non disponibile');
  const encConfig = { ...cfg, width:W, height:H, framerate:fps, bitrate, bitrateMode:'constant', avc:{ format:'annexb' } };
  const mp4 = MP4Box.createFile(); const chunks = []; const segCtx = { nextFileStart: 0 };
  mp4.onSegment = (id, user, buffer) => { buffer.fileStart = user.nextFileStart; user.nextFileStart += buffer.byteLength; chunks.push(buffer); };
  let trackId = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const ts = chunk.timestamp; const dur = chunk.duration || Math.round(1e6 / fps);
      const key = (chunk.type === 'key'); const buf = new Uint8Array(chunk.byteLength); chunk.copyTo(buf);
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
  const total = tl.frames; const frameDurUs = Math.round(1e6 / fps);
  for (let f=0; f<total; f++){
    renderAt(tl, items, W, H, f / fps);
    const vf = new VideoFrame(VidCanvas, { timestamp: f * frameDurUs });
    encoder.encode(vf, { keyFrame: (f===0) || (f % (fps*2) === 0) });
    vf.close();
    if ((f % fps) === 0){ ActionProgress.value = Math.round((f/total)*100); await new Promise(r => setTimeout(r)); }
  }
  await encoder.flush(); encoder.close(); mp4.flush(); hideEl(ActionProgressWrap);
  return new Blob(chunks, { type:'video/mp4' });
}
async function exportWithMediaRecorder(items, {T,F,fps,W,H,mime,bitrate}){
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = 'Esportazione in corso…';
  VidCanvas.width = W; VidCanvas.height = H;
  const tl = buildTimelineVideo(items.length, T, F, fps);
  const str = VidCanvas.captureStream(fps);
  const rec = new MediaRecorder(str, { mimeType: mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: 128000 });
  const parts = []; rec.ondataavailable = e => { if (e.data?.size) parts.push(e.data); };
  const stopped = new Promise(res => rec.onstop = res);
  rec.start(Math.min(1000, Math.round(1000/fps)));
  const t0 = performance.now(); let rafId = 0;
  (function loop(){ const now = performance.now(); const tSec = Math.min((now - t0)/1000, T);
    renderAt(tl, items, W, H, tSec); ActionProgress.value = Math.min(100, Math.round((tSec/T)*100));
    if (tSec < T) rafId = requestAnimationFrame(loop); })();
  await new Promise(r => setTimeout(r, Math.max(0, T*1000)));
  rec.stop(); if (rafId) cancelAnimationFrame(rafId); await stopped; hideEl(ActionProgressWrap);
  return new Blob(parts, { type: mime });
}
async function exportVideoSlideshow(){
  const title = (VidTitle?.value || '').trim();
  if (!title){ alert('Inserisci “Nome video”.'); return; }
  if (!pickedVideo.length){ alert('Carica una cartella con immagini.'); return; }
  const T = parseFloat(VidDuration.value); const F = 1.0; const fps = 30;
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
// Logo personalizzato
const DropAreaLogo = $('#DropAreaLogo');
const TxtLogoName  = $('#TxtLogoName');
const BtnClearLogo = $('#BtnClearLogo');
let customLogoFile = null;

if (DropAreaLogo){
  const stop = e => { e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => DropAreaLogo.addEventListener(ev, stop));
  DropAreaLogo.addEventListener('dragenter', ()=> DropAreaLogo.classList.add('drag-over'));
  DropAreaLogo.addEventListener('dragleave', ()=> DropAreaLogo.classList.remove('drag-over'));
  DropAreaLogo.addEventListener('drop', (e)=>{
    DropAreaLogo.classList.remove('drag-over');
    const f = e.dataTransfer?.files?.[0]; if (!f) return;
    customLogoFile = f; TxtLogoName.textContent = f.name; BtnClearLogo.classList.remove('hidden');
  });
  DropAreaLogo.addEventListener('click', ()=>{
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = ()=>{ const f = inp.files?.[0]; if (!f) return; customLogoFile = f; TxtLogoName.textContent = f.name; BtnClearLogo.classList.remove('hidden'); };
    inp.click();
  });
  BtnClearLogo?.addEventListener('click', (e)=>{
    e.stopPropagation(); customLogoFile = null;
    TxtLogoName.textContent = 'Trascina qui il logo o clicca per sfogliare… (PNG trasparente)';
    BtnClearLogo.classList.add('hidden');
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
function drawLogoCenter(canvas, logoBmp){
  if (!logoBmp) return;
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
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
    const canvas = drawFitToCanvas(bmp, 1024, 768, 'cover');
    drawLogoCenter(canvas, logo);
    const jpg = await canvasToBlob(canvas,'image/jpeg',0.92);
    const nn = String(++counterImg).padStart(2,'0');
    zip.file(`_EXPORT_WATERMARK/immagini/immagini-${nn}.jpg`, jpg);
    ActionProgress.value = Math.round((++done/total)*100);
  }

  // PDF (A3) → contain con bande bianche
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
      const canvas = drawFitToCanvas(bmp, 1024, 768, 'contain');
      drawLogoCenter(canvas, logo);
      const jpg = await canvasToBlob(canvas,'image/jpeg',0.92);
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

/* ========================= BIGLIETTO DA VISITA ======================== */
const BvPdfTpl   = $('#BvPdfTpl');
const BvFullName = $('#BvFullName');
const BvJobTitle = $('#BvJobTitle');
const BvPhone    = $('#BvPhone');
const BvEmail    = $('#BvEmail');
const BvRea      = $('#BvRea');
const BvAddFront = $('#BvAddFront');
const BvMakeBtn  = $('#BvMakeBtn');

async function exportBusinessCard(){
  const f = BvPdfTpl?.files?.[0];
  if (!f) { alert('Seleziona un PDF template con form (back_form/back_rea_form).'); return; }
  const tplBytes = new Uint8Array(await f.arrayBuffer());

  // 1) Compila il back (con form)
  let pdfDoc = await PDFLib.PDFDocument.load(tplBytes);
  const form = pdfDoc.getForm();
  const map = {
    FullName: BvFullName.value || '',
    JobTitle: BvJobTitle.value || '',
    Phone:    BvPhone.value    || '',
    Email:    BvEmail.value    || ''
  };
  if ((BvRea.value||'').trim()) map.ReaCode = BvRea.value.trim();
  for (const k of Object.keys(map)){ try { form.getTextField(k).setText(map[k]); } catch {} }
  form.flatten();
  const backFilledBytes = await pdfDoc.save();

  // 2) Se richiesto, anteponi front.pdf
  if (BvAddFront?.checked) {
    const frontUrl = 'assets/templates/businesscard/abitareco/front.pdf';
    let frontBytes;
    try {
      const resp = await fetch(frontUrl, { cache:'no-store' });
      if (!resp.ok) throw new Error('front.pdf non trovato');
      frontBytes = new Uint8Array(await resp.arrayBuffer());
    } catch {
      alert('front.pdf non trovato in assets/templates/businesscard/abitareco/. Procedo solo con il back compilato.');
      const aOnly = document.createElement('a');
      aOnly.href = URL.createObjectURL(new Blob([backFilledBytes], {type:'application/pdf'}));
      aOnly.download = `biglietto-${(BvFullName.value||'utente').toLowerCase().replace(/\s+/g,'-')}.pdf`;
      aOnly.click(); URL.revokeObjectURL(aOnly.href); return;
    }
    const finalDoc = await PDFLib.PDFDocument.create();
    const frontDoc = await PDFLib.PDFDocument.load(frontBytes);
    const backDoc  = await PDFLib.PDFDocument.load(backFilledBytes);
    const [frontPage] = await finalDoc.copyPages(frontDoc, [0]);
    const [backPage]  = await finalDoc.copyPages(backDoc,  [0]);
    finalDoc.addPage(frontPage); finalDoc.addPage(backPage);
    const out = await finalDoc.save();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([out], {type:'application/pdf'}));
    a.download = `biglietto-${(BvFullName.value||'utente').toLowerCase().replace(/\s+/g,'-')}.pdf`;
    a.click(); URL.revokeObjectURL(a.href); return;
  }

  // 3) Solo back compilato
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([backFilledBytes], {type:'application/pdf'}));
  a.download = `biglietto-${(BvFullName.value||'utente').toLowerCase().replace(/\s+/g,'-')}.pdf`;
  a.click(); URL.revokeObjectURL(a.href);
}
BvMakeBtn?.addEventListener('click', exportBusinessCard);

/* =============================== QR + UTM ============================= */
const QrBase     = $('#QrBase');
const QrSource   = $('#QrSource');
const QrMedium   = $('#QrMedium');
const QrCampaign = $('#QrCampaign');
const QrId       = $('#QrId');
const QrTerm     = $('#QrTerm');
const QrContent  = $('#QrContent');
const QrMakeBtn  = $('#QrMakeBtn');
const QrCanvas   = $('#QrCanvas');
const QrUrlOut   = $('#QrUrlOut');
const QrDownloadPng = $('#QrDownloadPng');
const QrDownloadSvg = $('#QrDownloadSvg');

function buildUtmUrl(){
  const base = (QrBase.value||'').trim();
  const u = new URL(base);
  const set = (k, el) => { const v = (el.value||'').trim(); if (v) u.searchParams.set(k,v); };
  set('utm_source',   QrSource);
  set('utm_medium',   QrMedium);
  set('utm_campaign', QrCampaign);
  set('utm_id',       QrId);
  set('utm_term',     QrTerm);
  set('utm_content',  QrContent);
  return u.toString();
}
async function makeQr(){
  try{
    const url = buildUtmUrl();
    QrUrlOut.textContent = url;
    await QRCode.toCanvas(QrCanvas, url, { width:256, margin:1 });
    // PNG
    QrCanvas.toBlob(b=>{
      if (!b) return;
      const url = URL.createObjectURL(b);
      QrDownloadPng.href = url;
      QrDownloadPng.classList.remove('hidden');
    }, 'image/png');
    // SVG
    const svgStr = await QRCode.toString(url, { type:'svg', margin:1, width:256 });
    const svgUrl = URL.createObjectURL(new Blob([svgStr], {type:'image/svg+xml'}));
    QrDownloadSvg.href = svgUrl;
    QrDownloadSvg.classList.remove('hidden');
  } catch(e){ alert('Controlla URL base (deve iniziare con http/https)'); }
}
QrMakeBtn?.addEventListener('click', makeQr);

/* ================================ IUBENDA ============================= */
const IubSiteId    = $('#IubSiteId');
const IubCookieIt  = $('#IubCookieIt');
const IubCookieEn  = $('#IubCookieEn');
const IubWidgetUrl = $('#IubWidgetUrl');
const IubDualLang  = $('#IubDualLang');
const IubMakeBtn   = $('#IubMakeBtn');
const IubOut       = $('#IubOut');

function makeIubendaSnippet(){
  const siteId = (IubSiteId.value||'').trim();
  const cpIt   = (IubCookieIt.value||'').trim();
  const cpEn   = (IubCookieEn.value||'').trim();
  const widget = (IubWidgetUrl.value||'//cdn.iubenda.com/cs/iubenda_cs.js').trim();
  if (!siteId || !cpIt) { alert('Compila siteId e cookiePolicyId IT.'); return; }
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
  if (IubDualLang.checked && cpEn){
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
  IubOut.value = snippet.trim();
}
IubMakeBtn?.addEventListener('click', makeIubendaSnippet);

/* -------------------------- Dispatcher globale ------------------------ */
BtnProcedi?.addEventListener('click', async ()=>{
  try {
    BtnProcedi.disabled = true;
    if (currentMode === 'images')    { await exportImages(); return; }
    if (currentMode === 'digitaltool'){ await exportDigitalTool(); return; }
    if (currentMode === 'pdf2jpg')   { await exportPdfToJpg(); return; }
    if (currentMode === 'rename')    { await exportRename(); return; }
    if (currentMode === 'video')     { await exportVideoSlideshow(); return; }
    if (currentMode === 'watermark') { await exportWatermarkPortali(); return; }
    alert("Funzione non attiva.");
  } finally {
    BtnProcedi.disabled = false;
  }
});

/* ------------------------------ PPT download -------------------------- */
window.downloadPPT = (href) => {
  const a = document.createElement('a'); a.href = href; a.download = href.split('/').pop(); a.click();
};
