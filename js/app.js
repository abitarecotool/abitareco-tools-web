/* =========================================================
 Abitare Co. – Digital Content Tool (Web)
 app.js — Immagini + DigitalTool + PDF→JPG + Rename + (NEW) Video
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
const ActionProgress = $('#ActionProgress');
const ActionProgressLabel= $('#ActionProgressLabel');

/* Cards */
const WelcomeCard = $('#WelcomeCard');
const SlugCard = $('#SlugCard');
const FormatCard = $('#FormatCard');
const UploadCard = $('#UploadCard');
const DTCard = $('#DTCard');
const RenameCard = $('#RenameCard');
const VideoCard = $('#VideoCard');
const BvCard = $('#BusinessCardCard');
const QrCard = $('#QrCard');
const IubCard = $('#IubendaCard');
const ALL_CARDS = [
  WelcomeCard, SlugCard, FormatCard, UploadCard,
  DTCard, RenameCard, VideoCard, BvCard, QrCard, IubCard
];

/* Stato */
let picked = [];        // Immagini / DigitalTool / PDF
let pickedRename = [];  // Rename
let currentMode = null;

/* ============= ICON SWITCHING ============= */
function initSidebarIcons(){
  $$('#SideMenu li').forEach(li=>{
    const img = li.querySelector('.mi img');
    if (img && li.dataset.icon){ img.src = li.dataset.icon; }
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

/* ============= NAVIGAZIONE ============= */
function selectMode(mode){
  currentMode = mode;
  ALL_CARDS.forEach(hideEl);
  BtnProcedi.classList.remove('hidden');
  switch(mode){
    case 'welcome': showEl(WelcomeCard); BtnProcedi.classList.add('hidden'); activateMenuVisual(''); return;
    case 'images':  showEl(SlugCard); showEl(FormatCard); showEl(UploadCard); break;
    case 'digitaltool': showEl(DTCard); showEl(UploadCard); break;
    case 'pdf2jpg': showEl(UploadCard); break;
    case 'rename':  showEl(RenameCard); break;
    case 'video':   showEl(VideoCard); break;
    case 'watermark': showEl(UploadCard); break;
    case 'bv': showEl(BvCard); break;
    case 'qr': showEl(QrCard); break;
    case 'iubenda': showEl(IubCard); break;
    default: showEl(WelcomeCard); BtnProcedi.classList.add('hidden'); activateMenuVisual(''); return;
  }
  activateMenuVisual(mode);
}
SideMenu?.addEventListener('click', (e)=>{
  const li = e.target.closest('li'); if (!li) return;
  selectMode(li.dataset.mode || 'welcome');
});
initSidebarIcons(); selectMode('welcome');

/* ===================================================
 🔻 DRAG & DROP: Sezione Generale (Immagini / DT / PDF)
=================================================== */
const DropArea = $('#DropArea');
const TxtFolderPath = $('#TxtFolderPath');
const BtnClearPath = $('#BtnClearPath');
if (DropArea) {
  function prevent(e){ e.preventDefault(); e.stopPropagation(); }
  ['dragenter','dragover','dragleave','drop'].forEach(ev =>
    DropArea.addEventListener(ev, prevent)
  );
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
        .filter(f => /\.(jpe?g|png|tif?f|pdf)$/i.test(f.name))
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
    picked = []; TxtFolderPath.textContent = 'Trascina qui la cartella…';
    BtnClearPath.classList.add('hidden');
  });
}

/* ===================================================
 🔻 DRAG & DROP: Sezione RENAME (separata)
=================================================== */
const DropAreaRename = $('#DropAreaRename');
const TxtFolderRename = $('#TxtFolderRename');
const BtnClearRename = $('#BtnClearRename');
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
  DropAreaRename.addEventListener('click', ()=>{
    const input = document.createElement('input');
    input.type = 'file'; input.webkitdirectory = true; input.multiple = true;
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
    pickedRename = []; TxtFolderRename.textContent = 'Trascina qui la cartella…';
    BtnClearRename.classList.add('hidden');
  });
}

/* ===================================================
 Lettura ricorsiva cartelle
=================================================== */
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
  if (hasEntries){ for (const it of items){ const en = it.webkitGetAsEntry(); if (en) await traverse(en, ''); } }
  return out;
}

/* ===================================================
 Helpers Immagini
=================================================== */
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
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const scale = Math.max(W/bmp.width, H/bmp.height);
  const dw = Math.round(bmp.width * scale), dh = Math.round(bmp.height * scale);
  const dx = Math.round((W - dw) / 2), dy = Math.round((H - dh) / 2);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, dx, dy, dw, dh);
  return canvas;
}
function canvasToBlob(canvas, mime, q=0.85){ return new Promise(res => canvas.toBlob(res, mime, q)); }

/* ===================================================
 EXPORT: IMMAGINI
=================================================== */
const TxtSlugIta = $('#TxtSlugIta');
const TxtSlugEng = $('#TxtSlugEng');
const Fmt1920 = $('#FmtSite1920');
const FmtShare = $('#FmtSiteShare');
const FmtCustom = $('#FmtSiteCustom');
const CustomRow = $('#CustomSizeRow');
const CustomW = $('#CustomW');
const CustomH = $('#CustomH');
function toggleCustomRow(){ FmtCustom.checked ? showEl(CustomRow) : hideEl(CustomRow); }
[Fmt1920, FmtShare, FmtCustom].forEach(r => r?.addEventListener('change', toggleCustomRow));
toggleCustomRow();
function getSelectedFormat(){
  if (FmtCustom.checked){ return { w: Math.max(1, Number(CustomW.value) || 1920), h: Math.max(1, Number(CustomH.value) || 1080) }; }
  if (FmtShare.checked) return { w:1200, h:630 };
  return { w:1920, h:1080 };
}
async function loadFolderMap(){
  try {
    const res = await fetch('./assets/folder_map.csv', {cache:'no-store'});
    if (!res.ok) return {};
    const txt = await res.text();
    const rows = txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if (!rows.length) return {};
    const header = rows[0].split(',').map(h=>h.trim().toLowerCase());
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
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = "Esporta immagini…";
  const total = images.length; let processed = 0;
  for (const [relFolder, recs] of groups){
    let leaf = ""; if (relFolder){ const parts = relFolder.split('/').filter(Boolean); leaf = parts.length ? parts[parts.length-1] : ''; }
    const leafIta = leaf || 'hero'; const leafEng = folderMap[leafIta] || leafIta;
    const slugFolderIta = slugify(leafIta); const slugFolderEng = slugify(leafEng);
    recs.sort((a,b)=> (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name));
    let counter = 0;
    for (const rec of recs){
      counter++; const nn = String(counter).padStart(2,'0');
      const baseIta = slugIta + (slugFolderIta ? `-${slugFolderIta}` : '');
      const baseEng = slugEng + (slugFolderEng ? `-${slugFolderEng}` : '');
      const outIta = `${baseIta}-${nn}`; const outEng = `${baseEng}-${nn}`;
      const bmp = await loadImageBitmap(rec.file);
      const canvas = drawCoverToCanvas(bmp, W, H);
      const webp = await canvasToBlob(canvas, 'image/webp', 0.85);
      const jpg  = await canvasToBlob(canvas, 'image/jpeg', 0.85);
      zip.file(`_EXPORT_SITO/ITA/WEBP/${outIta}.webp`, webp);
      zip.file(`_EXPORT_SITO/ITA/JPG/${outIta}.jpg`, jpg);
      zip.file(`_EXPORT_SITO/ENG/WEBP/${outEng}.webp`, webp);
      zip.file(`_EXPORT_SITO/ENG/JPG/${outEng}.jpg`, jpg);
      ActionProgress.value = Math.round((++processed/total)*100);
    }
  }
  const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `EXPORT_SITO-${slugIta}-${stamp}.zip`;
  a.click(); URL.revokeObjectURL(a.href);
  hideEl(ActionProgressWrap);
}

/* ===================================================
 DIGITAL TOOL
=================================================== */
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
    ctx.drawImage(bmp, dx, dy, dw, dh);
    return c;
  }
  if (w>=h){
    const W=2500, H=Math.round(h*(W/w));
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    c.getContext('2d').drawImage(bmp,0,0,W,H); return c;
  }
  { const H=2000, W=Math.round(w*(H/h));
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    c.getContext('2d').drawImage(bmp,0,0,W,H); return c; }
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
  const files = images.sort((a,b)=> (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name));
  const zip = new JSZip();
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = "DigitalTool…";
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
    if (jpg)  zip.file(`${basePathJPG}${nn}.jpg`, jpg);
    ActionProgress.value = Math.round((++processed/total)*100);
  }
  const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `DIGITALTOOL-${stamp}.zip`;
  a.click(); URL.revokeObjectURL(a.href);
  hideEl(ActionProgressWrap);
}

/* ===================================================
 PDF → JPG
=================================================== */
async function ensurePdfJs(){
  if (window.pdfjsLib) return;
  await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}
async function exportPdfToJpg(){
  const pdfs = picked.filter(p => /\.pdf$/i.test(p.file.name));
  if (!pdfs.length){ alert("Carica PDF."); return; }
  await ensurePdfJs();
  const zip = new JSZip();
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = "Converti PDF → JPG…";
  const TARGET = 1.5 * 1024 * 1024;
  const total = pdfs.length; let processed = 0;
  for (const rec of pdfs){
    const file = rec.file;
    const relPath = rec.relPath || rec.file.name;
    const relFolder = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '';
    const baseName = file.name.replace(/\.pdf$/i,'');
    const prefixDir = `_EXPORT_PDF2JPG/${relFolder ? relFolder + '/' : ''}`;
    const ab = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({data:ab}).promise;
    for (let pageNum=1; pageNum<=pdf.numPages; pageNum++){
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale:300/72 });
      const canvas=document.createElement('canvas');
      canvas.width=Math.ceil(viewport.width); canvas.height=Math.ceil(viewport.height);
      const ctx=canvas.getContext('2d');
      await page.render({ canvasContext:ctx, viewport }).promise;
      let blob = await canvasToBlob(canvas,'image/jpeg',0.95);
      if (blob.size > TARGET){
        const ladder=[0.90,0.85,0.80,0.75];
        for (const q of ladder){ const b = await canvasToBlob(canvas,'image/jpeg',q); blob=b; if (b.size <= TARGET) break; }
      }
      const suffix = pdf.numPages>1 ? `-${String(pageNum).padStart(2,'0')}` : '';
      zip.file(`${prefixDir}${baseName}${suffix}.jpg`, blob);
    }
    ActionProgress.value = Math.round((++processed/total)*100);
  }
  const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
  const blob = await zip.generateAsync({type:'blob'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`EXPORT_PDF2JPG-${stamp}.zip`;
  a.click(); URL.revokeObjectURL(a.href);
  hideEl(ActionProgressWrap);
}

/* ===================================================
 ✅ RENAME (01 / base-01)
=================================================== */
const TxtRenameBase = $('#TxtRenameBase');
async function exportRename(){
  const base = slugify(TxtRenameBase?.value || "").trim();
  const mode = base ? 2 : 1;
  const files = pickedRename.filter(p => /\.(jpe?g|png|tif?f|webp)$/i.test(p.file.name));
  if (!files.length){ alert("Carica una cartella per rinominare."); return; }
  const sorted = files.sort((a,b)=> (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name));
  const zip = new JSZip();
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = "Rinomina…";
  const total = sorted.length;
  for (let i=0; i<sorted.length; i++){
    const rec = sorted[i], file = rec.file;
    const ext = "." + file.name.split(".").pop().toLowerCase();
    const nn = String(i+1).padStart(2,'0');
    const newName = (mode === 1) ? `${nn}${ext}` : `${base}-${nn}${ext}`;
    zip.file(newName, file);
    ActionProgress.value = Math.round(((i+1)/total)*100);
  }
  const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
  const blob = await zip.generateAsync({type:'blob'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`RENAME-${stamp}.zip`;
  a.click(); URL.revokeObjectURL(a.href);
  hideEl(ActionProgressWrap);
}

/* ===================================================
 🎞️ VIDEO SLIDESHOW — Client-side
  - Formati: Orizzontale (1920×1080), Verticale (1080×1920), Quadrato (1080×1080)
  - HD di default: 12 Mbps (1080p), 8 Mbps (quadrato)
=================================================== */

// Stato + UI video
let pickedVideo = [];
const VidTitle    = $('#VidTitle');
const VidDuration = $('#VidDuration');
const VidFmtH = $('#VidFmtH');
const VidFmtV = $('#VidFmtV');
const VidFmtS = $('#VidFmtS');

const DropAreaVideo  = $('#DropAreaVideo');
const TxtFolderVideo = $('#TxtFolderVideo');
const BtnClearVideo  = $('#BtnClearVideo');

const VidCanvas  = $('#VidCanvas');

// Drag&drop VIDEO
if (DropAreaVideo) {
  function preventV(e){ e.preventDefault(); e.stopPropagation(); }
  ['dragenter','dragover','dragleave','drop'].forEach(ev =>
    DropAreaVideo.addEventListener(ev, preventV)
  );
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

// Utility timeline/render
function computeStill(T, N, F) {
  let still = (T - (N - 1) * F) / N;
  if (still <= 0) { F = Math.max(0, (T / Math.max(1, N - 1)) * 0.35); still = Math.max(0.3, (T - (N - 1) * F) / N); }
  return { still, fade: F };
}
function buildTimelineVideo(N, T, F, fps) {
  const { still, fade } = computeStill(T, N, F);
  const frames = Math.round(T * fps);
  const seg = [];
  for (let i=0;i<N;i++) seg.push(i < N-1 ? (still + fade) : still);
  const offsets = [0];
  for (let i=1;i<N;i++) offsets[i] = offsets[i-1] + seg[i-1];
  return { still, fade, offsets, frames };
}
function drawCoverOn(ctx, bmp, W, H) {
  const iw = bmp.width, ih = bmp.height;
  const cr = W / H, ir = iw / ih;
  let dw, dh, dx, dy;
  if (ir > cr) { dh = H; dw = Math.round(dh * ir); dx = Math.round((W - dw)/2); dy = 0; }
  else { dw = W; dh = Math.round(dw / ir); dx = 0; dy = Math.round((H - dh)/2); }
  ctx.drawImage(bmp, dx, dy, dw, dh);
}
function renderAt(tl, items, W, H, tSec) {
  const { still, fade, offsets } = tl;
  const ctx = VidCanvas.getContext('2d', { alpha:false });
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
  let i = 0;
  for (; i < items.length; i++) {
    const start = offsets[i];
    const segDur = (i < items.length-1 ? (still + fade) : still);
    if (tSec < start + segDur || i === items.length-1) break;
  }
  const start = offsets[i];
  const localT = tSec - start;
  const cur = items[i].bmp;
  if (i < items.length-1 && localT > still) {
    const alpha = Math.min(1, (localT - still) / fade);
    ctx.globalAlpha = 1; drawCoverOn(ctx, cur, W, H);
    ctx.globalAlpha = alpha; drawCoverOn(ctx, items[i+1].bmp, W, H);
    ctx.globalAlpha = 1;
  } else {
    drawCoverOn(ctx, cur, W, H);
  }
}
async function filesToBitmapsVideo(recs) {
  const arr = [];
  for (const r of recs) { const bmp = await loadImageBitmap(r.file); arr.push({ name: r.file.name, bmp }); }
  return arr;
}

// Scelte formato + bitrate HD
function pickVideoSize(){
  if (VidFmtV?.checked) return { W:1080, H:1920 };     // Verticale
  if (VidFmtS?.checked) return { W:1080, H:1080 };     // Quadrato
  return { W:1920, H:1080 };                           // Orizzontale
}
function pickBitrate(W,H,fps){
  // HD di default: 12 Mbps per 1080p (orizz./vert.), 8 Mbps per quadrato; scala con FPS
  const isSquare = (W===1080 && H===1080);
  let bps = isSquare ? 8e6 : 12e6;
  if (fps > 30) bps = Math.round(bps * (fps/30));
  return bps;
}

// Feature detection
function supportsMp4Recorder() {
  if (!('MediaRecorder' in window)) return null;
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4'
  ];
  for (const m of candidates) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {} }
  return null;
}
async function supportsH264WebCodecs() {
  if (!('VideoEncoder' in window)) return null;
  try {
    const test = await VideoEncoder.isConfigSupported({
      codec: 'avc1.42E01E', width: 1080, height: 1080, framerate: 30, hardwareAcceleration: 'prefer-hardware'
    });
    return test.supported ? test.config : null;
  } catch { return null; }
}

// WebCodecs (H.264) + MP4Box
async function exportWithWebCodecsMP4(items, {T, F, fps, W, H, bitrate}) {
  if (!window.MP4Box) throw new Error('MP4Box.js non caricato');
  showEl(ActionProgressWrap); ActionProgress.value = 0;
  ActionProgressLabel.textContent = 'Encoding (WebCodecs → MP4)…';
  VidCanvas.width = W; VidCanvas.height = H;
  const tl = buildTimelineVideo(items.length, T, F, fps);
  const cfg = await supportsH264WebCodecs(); if (!cfg) throw new Error('H.264 WebCodecs non disponibile');

  const encConfig = {
    ...cfg, width:W, height:H, framerate:fps,
    bitrate, bitrateMode:'constant',
    avc:{ format:'annexb' }
  };

  const mp4 = MP4Box.createFile();
  const chunks = []; const segCtx = { nextFileStart: 0 };
  mp4.onSegment = (id, user, buffer) => { buffer.fileStart = user.nextFileStart; user.nextFileStart += buffer.byteLength; chunks.push(buffer); };

  let trackId = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const ts = chunk.timestamp; const dur = chunk.duration || Math.round(1e6/fps);
      const isKey = chunk.type === 'key';
      const copy = new Uint8Array(chunk.byteLength); chunk.copyTo(copy);
      if (!trackId && meta?.decoderConfig?.description) {
        trackId = mp4.addTrack({ timescale:1e6, width:W, height:H, h264:{ avcDecoderConfigRecord: meta.decoderConfig.description } });
        mp4.setSegmentOptions(trackId, segCtx, { nbSamples: 1000000 });
        const inits = mp4.initializeSegmentation();
        inits.forEach(seg => { seg.buffer.fileStart = segCtx.nextFileStart; segCtx.nextFileStart += seg.buffer.byteLength; chunks.push(seg.buffer); });
      }
      mp4.addSample(trackId, copy.buffer, { dts:ts, cts:ts, duration:dur, is_sync:isKey });
    },
    error: e => console.error(e)
  });
  encoder.configure(encConfig);

  const totalFrames = tl.frames; const frameDurUs = Math.round(1e6 / fps);
  for (let f=0; f<totalFrames; f++) {
    renderAt(tl, items, W, H, f / fps);
    const frame = new VideoFrame(VidCanvas, { timestamp: f * frameDurUs });
    encoder.encode(frame, { keyFrame: (f===0) || (f % (fps*2) === 0) }); frame.close();
    if ((f % fps) === 0) { ActionProgress.value = Math.round((f/totalFrames)*100); await new Promise(r => setTimeout(r)); }
  }
  await encoder.flush(); encoder.close(); mp4.flush();
  hideEl(ActionProgressWrap);
  return new Blob(chunks, { type: 'video/mp4' });
}

// MediaRecorder (MP4 su Safari, WebM fallback) con bitrate alto
async function exportWithMediaRecorder(items, {T, F, fps, W, H, mime, bitrate}) {
  showEl(ActionProgressWrap); ActionProgress.value = 0;
  ActionProgressLabel.textContent = `Registrazione (${mime})…`;
  VidCanvas.width = W; VidCanvas.height = H;
  const tl = buildTimelineVideo(items.length, T, F, fps);
  const stream = VidCanvas.captureStream(fps);
  const rec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: bitrate,
    audioBitsPerSecond: 128000
  });
  const parts = [];
  rec.ondataavailable = e => { if (e.data?.size) parts.push(e.data); };
  const done = new Promise(res => rec.onstop = res);
  rec.start(Math.min(1000, Math.round(1000/fps)));

  const totalFrames = tl.frames;
  for (let f=0; f<totalFrames; f++) {
    renderAt(tl, items, W, H, f / fps);
    await new Promise(requestAnimationFrame);
    if ((f % fps) === 0) ActionProgress.value = Math.round((f/totalFrames)*100);
  }
  rec.stop(); await done; hideEl(ActionProgressWrap);
  return new Blob(parts, { type: mime });
}

// Export principale
async function exportVideoSlideshow(){
  const title = slugify(VidTitle?.value || '');
  if (!title){ alert('Inserisci “Nome video”.'); return; }
  if (!pickedVideo.length){ alert('Carica una cartella con immagini.'); return; }

  const T   = parseFloat(VidDuration.value);   // 15/30/45
  const F   = 1.0;                             // dissolvenza default
  const fps = 30;                              // fps default
  const { W, H } = pickVideoSize();
  const bitrate = pickBitrate(W,H,fps);

  const items = await filesToBitmapsVideo(pickedVideo);
  const h264Cfg = await supportsH264WebCodecs();
  const mp4Mime = supportsMp4Recorder();

  let blob, filename;

  if (h264Cfg && window.MP4Box) {
    blob = await exportWithWebCodecsMP4(items, { T, F, fps, W, H, bitrate });
    filename = `${title}.mp4`;
  } else if (mp4Mime) {
    blob = await exportWithMediaRecorder(items, { T, F, fps, W, H, mime: mp4Mime, bitrate }, );
    filename = `${title}.mp4`;
  } else {
    const webmMime = (window.MediaRecorder && MediaRecorder.isTypeSupported('video/webm;codecs=vp9'))
      ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8';
    blob = await exportWithMediaRecorder(items, { T, F, fps, W, H, mime: webmMime, bitrate }, );
    filename = `${title}.webm`;
  }

  // Solo download (anteprima rimossa)
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ===================================================
 DISPATCHER BOTTONE "ESPORTA ORA"
=================================================== */
BtnProcedi?.addEventListener('click', async ()=>{
  try {
    BtnProcedi.disabled = true;
    if (currentMode === 'images'){ await exportImages(); return; }
    if (currentMode === 'digitaltool'){ await exportDigitalTool(); return; }
    if (currentMode === 'pdf2jpg'){ await exportPdfToJpg(); return; }
    if (currentMode === 'rename'){ await exportRename(); return; }
    if (currentMode === 'video'){ await exportVideoSlideshow(); return; }
    alert("Funzione non attiva.");
  } finally { BtnProcedi.disabled = false; }
});
