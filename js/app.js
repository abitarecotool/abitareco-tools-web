/* =========================================================
   Abitare Co. – Digital Content Tool (Web)
   app.js — Immagini + DigitalTool (WEBP/JPG separati) + PDF→JPG
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
const VideoCard    = $('#VideoCard');
const BvCard       = $('#BusinessCardCard');
const QrCard       = $('#QrCard');
const IubCard      = $('#IubendaCard');
const ALL_CARDS    = [WelcomeCard, SlugCard, FormatCard, UploadCard, DTCard, VideoCard, BvCard, QrCard, IubCard];

/* Stato */
let picked = [];           // [{file, relPath}]
let currentMode = null;    // 'images' | 'digitaltool' | 'pdf2jpg' | ...

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
      showEl(UploadCard); break;

    case 'rename':    showEl(UploadCard); break;
    case 'video':     showEl(UploadCard); showEl(VideoCard); break;
    case 'watermark': showEl(UploadCard); break;
    case 'bv':        showEl(BvCard); break;
    case 'qr':        showEl(QrCard); break;
    case 'iubenda':   showEl(IubCard); break;

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
      .filter(f => /\.(jpe?g|png|tif?f|pdf)$/i.test(f.name))
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
      if (/\.(jpe?g|png|tif?f|pdf)$/i.test(f.name)){
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
    const folder = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(rec);
  }

  const zip = new JSZip();
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent='Elaborazione…';
  const total = images.length; let processed = 0;

  for (const [relFolder, recs] of groups){
    let leaf = '';
    if (relFolder){
      const parts = relFolder.split('/').filter(Boolean);
      leaf = (parts.length ? parts[parts.length-1] : '').toLowerCase();
    }
    const leafIta = leaf || 'hero';
    const leafEng = folderMap[leafIta] || leafIta;
    const slugFolderIta = slugify(leafIta);
    const slugFolderEng = slugify(leafEng);

    recs.sort((a,b)=> (a.relPath||a.file.name).localeCompare(b.relPath||b.file.name));
    let counter = 0;

    for (const rec of recs){
      counter++; const nn = String(counter).padStart(2,'0');

      const baseIta = slugIta + (slugFolderIta ? `-${slugFolderIta}` : '');
      const baseEng = slugEng + (slugFolderEng ? `-${slugFolderEng}` : '');
      const outIta  = `${baseIta}-${nn}`;
      const outEng  = `${baseEng}-${nn}`;

      const bmp = await loadImageBitmap(rec.file);
      const canvas = drawCoverToCanvas(bmp, W, H);

      const webp = await canvasToBlob(canvas,'image/webp',0.85);
      const jpg  = await canvasToBlob(canvas,'image/jpeg',0.85);

      zip.file(`_EXPORT_SITO/ITA/WEBP/${outIta}.webp`, webp);
      zip.file(`_EXPORT_SITO/ITA/JPG/${outIta}.jpg`,  jpg);
      zip.file(`_EXPORT_SITO/ENG/WEBP/${outEng}.webp`, webp);
      zip.file(`_EXPORT_SITO/ENG/JPG/${outEng}.jpg`,   jpg);

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

/* =================== DIGITAL TOOL (WEBP/JPG in cartelle separate) =================== */
/* Regole: quadre → 2000×2000 (cover) | orizzontali → larghezza 2500 px | verticali → altezza 2000 px
   Nomi: SOLO numeri per cartella; soglia 450KB con ricompressione */
function makeCanvasFromRules(bmp){
  const w=bmp.width, h=bmp.height;
  const ratio=w/h;
  const square = Math.abs(ratio-1.0) <= 0.03;

  if (square){
    const W=2000,H=2000; // cover 2000x2000
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const ctx=c.getContext('2d',{alpha:false});
    const scale = Math.max(W/w, H/h);
    const dw=Math.round(w*scale), dh=Math.round(h*scale);
    const dx=Math.round((W-dw)/2), dy=Math.round((H-dh)/2);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(bmp, dx, dy, dw, dh);
    return c;
  }

  if (w>=h){
    const W=2500, outW=W, outH=Math.round(h*(W/w)); // fit width
    const c=document.createElement('canvas'); c.width=outW; c.height=outH;
    const ctx=c.getContext('2d',{alpha:false});
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(bmp, 0, 0, outW, outH);
    return c;
  }

  const H=2000, outH=H, outW=Math.round(w*(H/h)); // fit height
  const c=document.createElement('canvas'); c.width=outW; c.height=outH;
  const ctx=c.getContext('2d',{alpha:false});
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  ctx.drawImage(bmp, 0, 0, outW, outH);
  return c;
}
async function toBlobCapped(canvas, mime){
  const ladder=[0.85,0.75,0.65,0.50,0.40];
  for (const q of ladder){
    const b = await new Promise(res=> canvas.toBlob(res, mime, q));
    if (!b) continue;
    if (b.size <= 450*1024) return b;
    if (q === ladder[ladder.length-1]) return b;
  }
}

async function exportDigitalTool(){
  const images = picked.filter(p => /\.(jpe?g|png|tif?f)$/i.test(p.file.name));
  if (!images.length){ alert('Seleziona o trascina una cartella con immagini.'); return; }

  const files = images.sort((a,b)=> (a.relPath||a.file.name).localeCompare(b.relPath||b.file.name));
  const zip = new JSZip();
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent='DigitalTool…';

  const countsByFolder = new Map(); // per cartella
  const total = files.length; let processed = 0;

  for (const rec of files){
    const p = rec.relPath || rec.file.name;
    const relFolder = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';

    const current = countsByFolder.get(relFolder) || 0;
    const nn = String(current + 1).padStart(2,'0');
    countsByFolder.set(relFolder, current + 1);

    // >>> separazione per formato
    const basePathWEBP = `_DIGITALTOOL/${relFolder ? relFolder + '/' : ''}WEBP/`;
    const basePathJPG  = `_DIGITALTOOL/${relFolder ? relFolder + '/' : ''}JPG/`;

    const bmp = await loadImageBitmap(rec.file);
    const canvas = makeCanvasFromRules(bmp);

    const webp = await toBlobCapped(canvas,'image/webp');
    const jpg  = await toBlobCapped(canvas,'image/jpeg');

    if (webp) zip.file(`${basePathWEBP}${nn}.webp`, webp);
    if (jpg)  zip.file(`${basePathJPG}${nn}.jpg`,   jpg);

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

/* =================== PDF → JPG =================== */
/* Lazy‑load PDF.js (UMD) e worker allineato */
async function ensurePdfJs(){
  if (window.pdfjsLib) return;
  await new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

async function exportPdfToJpg(){
  const pdfs = picked.filter(p => /\.pdf$/i.test(p.file.name));
  if (!pdfs.length){ alert('Seleziona o trascina una cartella con file PDF.'); return; }

  await ensurePdfJs();

  const zip = new JSZip();
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent='Conversione PDF → JPG…';

  const TARGET = 1.5 * 1024 * 1024; // 1.5MB
  const total = pdfs.length; let processed = 0;

  for (const rec of pdfs){
    const file = rec.file;
    const relPath = rec.relPath || rec.file.name;
    const relFolder = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '';
    const baseName  = file.name.replace(/\.pdf$/i,'');
    const prefixDir = `_EXPORT_PDF2JPG/${relFolder ? relFolder + '/' : ''}`;

    const ab = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;

    for (let pageNum=1; pageNum<=pdf.numPages; pageNum++){
      const page = await pdf.getPage(pageNum);
      // ~300 dpi → scale 300/72
      const viewport = page.getViewport({ scale: 300/72 });
      const canvas = document.createElement('canvas');
      canvas.width  = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      // export con quality ladder → <= 1.5MB
      let blob = await canvasToBlob(canvas,'image/jpeg',0.95);
      if (blob.size > TARGET){
        const ladder=[0.90,0.85,0.80,0.75];
        for (const q of ladder){
          const b = await canvasToBlob(canvas,'image/jpeg',q);
          blob = b;
          if (b.size <= TARGET) break;
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

/* =================== Dispatcher “Esporta ora” =================== */
BtnProcedi?.addEventListener('click', async ()=>{
  try{
    BtnProcedi.disabled = true;

    if (currentMode === 'images'){       await exportImages();      return; }
    if (currentMode === 'digitaltool'){  await exportDigitalTool(); return; }
    if (currentMode === 'pdf2jpg'){      await exportPdfToJpg();    return; }

    if (!currentMode){ alert('Seleziona una funzione dal menu.'); return; }
    alert('Questa funzione sarà attivata nelle prossime build.');
  } finally {
    BtnProcedi.disabled = false;
  }
});
