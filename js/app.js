/* =========================================================
   Abitare Co. – Digital Content Tool (Web)
   app.js — Welcome (senza bottone), Sidebar, Immagini, DigitalTool
   ========================================================= */

/* Helpers */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const show = (el) => el && el.classList.remove('hidden');
const hide = (el) => el && el.classList.add('hidden');
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));

/* Sidebar & ActionBar */
const SideMenu = $('#SideMenu');
const ActionProgressWrap = $('#ActionProgressWrap');
const ActionProgress     = $('#ActionProgress');
const BtnProcedi         = $('#BtnProcedi');

/* Sezioni */
const WelcomeCard  = $('#WelcomeCard');
const SlugCard     = $('#SlugCard');      // Immagini
const FormatCard   = $('#FormatCard');    // Immagini
const UploadCard   = $('#UploadCard');    // comune
const DTCard       = $('#DTCard');        // DigitalTool
const VideoCard    = $('#VideoCard');
const BvCard       = $('#BusinessCardCard');
const QrCard       = $('#QrCard');
const IubCard      = $('#IubendaCard');

const ALL_CARDS = [WelcomeCard, SlugCard, FormatCard, UploadCard, DTCard, VideoCard, BvCard, QrCard, IubCard];

/* Inizializza icone sidebar da data-attributes */
function initSidebarIcons(){
  $$('#SideMenu li').forEach(li=>{
    const img = li.querySelector('.mi img');
    if (!img) return;
    const icon = li.dataset.icon;
    if (icon) img.src = icon;
  });
}
function activateMenuVisual(mode){
  $$('#SideMenu li').forEach(li=>{
    li.classList.remove('active');
    const img = li.querySelector('.mi img');
    const icon = li.dataset.icon;
    const iconActive = li.dataset.iconActive || icon;
    if (li.dataset.mode === mode){
      li.classList.add('active');
      if (img) img.src = iconActive || icon;
    } else {
      if (img) img.src = icon || img.src;
    }
  });
}

/* Navigazione */
function selectMode(mode){
  ALL_CARDS.forEach(hide);

  // di default il bottone è visibile, TRANNNE che in welcome
  BtnProcedi?.classList.remove('hidden');

  switch(mode){
    case 'welcome':
      show(WelcomeCard);
      BtnProcedi?.classList.add('hidden');        // niente bottone su Welcome
      activateMenuVisual('');                     // nessuna voce attiva
      return;

    case 'images':
      show(SlugCard);
      show(FormatCard);
      show(UploadCard);
      break;

    case 'digitaltool':
      show(UploadCard);
      show(DTCard);
      break;

    case 'pdf2jpg':    show(UploadCard); break;
    case 'rename':     show(UploadCard); break;
    case 'video':      show(UploadCard); show(VideoCard); break;
    case 'watermark':  show(UploadCard); break;
    case 'bv':         show(BvCard); break;
    case 'qr':         show(QrCard); break;
    case 'iubenda':    show(IubCard); break;

    default:
      show(WelcomeCard);
      BtnProcedi?.classList.add('hidden');
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

/* Avvio: Welcome senza bottone */
initSidebarIcons();
selectMode('welcome');

/* =================== IMMAGINI =================== */
const TxtSlugIta = $('#TxtSlugIta');
const TxtSlugEng = $('#TxtSlugEng');

const Fmt1920   = $('#FmtSite1920');
const FmtShare  = $('#FmtSiteShare');
const FmtCustom = $('#FmtSiteCustom');
const CustomRow = $('#CustomSizeRow');
const CustomW   = $('#CustomW');
const CustomH   = $('#CustomH');

function toggleCustomRow(){ FmtCustom?.checked ? show(CustomRow) : hide(CustomRow); }
[Fmt1920, FmtShare, FmtCustom].forEach(r=> r?.addEventListener('change', toggleCustomRow));
toggleCustomRow();

/* =================== Upload (drag&drop + click per aprire cartella) =================== */
const DropArea = $('#DropArea');
const TxtFolderPath = $('#TxtFolderPath');
const BtnClearPath  = $('#BtnClearPath');
const DirInput      = $('#DirInput');

let picked = []; // [{ file, relPath }]

function dropPreventDefaults(e){ e.preventDefault(); e.stopPropagation(); }
['dragenter','dragover','dragleave','drop'].forEach(ev => DropArea?.addEventListener(ev, dropPreventDefaults));
DropArea?.addEventListener('dragenter', ()=> DropArea.classList.add('focus'));
DropArea?.addEventListener('dragleave', ()=> DropArea.classList.remove('focus'));
DropArea?.addEventListener('drop', async (e)=>{
  DropArea.classList.remove('focus');
  picked = await readDroppedDirectory(e.dataTransfer);
  TxtFolderPath.textContent = picked.length ? `Selezionati ${picked.length} file…` : 'Nessun file supportato.';
  BtnClearPath?.classList.toggle('hidden', picked.length===0);
});

/* CLICK SUL BOX → apri selezione cartella */
DropArea?.addEventListener('click', ()=> DirInput?.click());

/* on change input directory */
DirInput?.addEventListener('change', ()=>{
  const fl = DirInput.files ? Array.from(DirInput.files) : [];
  picked = fl
    .filter(f => /\.(jpe?g|png|tif?f)$/i.test(f.name))
    .map(f => ({ file:f, relPath: f.webkitRelativePath || f.name }));
  TxtFolderPath.textContent = picked.length ? `Selezionati ${picked.length} file…` : 'Nessun file supportato.';
  BtnClearPath?.classList.toggle('hidden', picked.length===0);
});

BtnClearPath?.addEventListener('click', ()=>{
  picked=[]; TxtFolderPath.textContent='Trascina qui la cartella...';
  BtnClearPath.classList.add('hidden');
});

/* ===== Helpers: lettura directory ricorsiva da drag&drop ===== */
async function readDroppedDirectory(dt){
  const items = dt?.items ? Array.from(dt.items) : [];
  const out = [];

  async function traverse(entry, base=''){
    if (entry.isFile){
      const f = await new Promise(res=> entry.file(res));
      if (/\.(jpe?g|png|tif?f)$/i.test(f.name)){
        out.push({ file:f, relPath: base ? `${base}/${f.name}` : f.name });
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
  } else {
    const files = dt?.files ? Array.from(dt.files) : [];
    for (const f of files){
      if (/\.(jpe?g|png|tif?f)$/i.test(f.name)) out.push({ file:f, relPath:f.name });
    }
  }
  return out;
}

/* ===== Helpers immagini / canvas ===== */
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

/* ====== IMMAGINI → export ZIP ====== */
function getSelectedFormat(){
  if (FmtCustom?.checked){
    const w = Number(CustomW?.value)||1920, h = Number(CustomH?.value)||1080;
    return {w,h};
  }
  if (FmtShare?.checked) return {w:1200,h:630};
  return {w:1920,h:1080};
}
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
  if (!slugIta || !slugEng){ alert('Inserisci gli slug ITA/ENG.'); return; }
  if (!picked.length){ alert('Seleziona o trascina una cartella con immagini.'); return; }

  const {w:W, h:H} = getSelectedFormat();
  const folderMap = await loadFolderMap();

  const groups = new Map(); // relFolder -> recs
  for (const rec of picked){
    const p = rec.relPath||rec.file.name;
    const folder = p.includes('/')? p.slice(0,p.lastIndexOf('/')) : '';
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(rec);
  }

  const zip = new JSZip();
  const paths = {
    itaJpg: '_EXPORT_SITO/ITA/JPG/',
    itaWebp:'_EXPORT_SITO/ITA/WEBP/',
    engJpg: '_EXPORT_SITO/ENG/JPG/',
    engWebp:'_EXPORT_SITO/ENG/WEBP/'
  };

  show(ActionProgressWrap); ActionProgress.value = 0;
  const total = picked.length; let processed = 0;

  for (const [relFolder, recs] of groups){
    // leaf cartella (o 'hero')
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

      const baseIta = (slugIta + (slugFolderIta ? `-${slugFolderIta}` : ''));
      const baseEng = (slugEng + (slugFolderEng ? `-${slugFolderEng}` : ''));
      const outIta = `${baseIta}-${nn}`;
      const outEng = `${baseEng}-${nn}`;

      const bmp = await loadImageBitmap(rec.file);
      const canvas = drawCoverToCanvas(bmp, W, H);

      const webp = await canvasToBlob(canvas,'image/webp',0.85);
      const jpg  = await canvasToBlob(canvas,'image/jpeg',0.85);

      if (webp) zip.file(`${paths.itaWebp}${outIta}.webp`, webp);
      if (jpg)  zip.file(`${paths.itaJpg}${outIta}.jpg`,  jpg);
      if (webp) zip.file(`${paths.engWebp}${outEng}.webp`, webp);
      if (jpg)  zip.file(`${paths.engJpg}${outEng}.jpg`,   jpg);

      processed++; ActionProgress.value = Math.floor((processed/total)*100);
      await sleep(2);
    }
  }

  const ts = new Date();
  const stamp = ts.toISOString().slice(0,10).replace(/-/g,'') + ts.toTimeString().slice(0,5).replace(':','');
  const zipName = `EXPORT_SITO-${slugIta||'site'}-${stamp}.zip`;

  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = zipName;   // salva in Download
  document.body.appendChild(a); a.click();
  URL.revokeObjectURL(a.href); a.remove();

  await sleep(250); hide(ActionProgressWrap);
}

/* =================== DIGITAL TOOL (1:1 col PS) =================== */
function makeCanvasFromRules(bmp){
  const w=bmp.width, h=bmp.height;
  const ratio = w/h;
  const square = Math.abs(ratio - 1.0) <= 0.03;

  if (square){
    const W=2500,H=2500;
    const scale = Math.max(W/w, H/h);
    const dw=Math.round(w*scale), dh=Math.round(h*scale);
    const dx=Math.round((W-dw)/2), dy=Math.round((H-dh)/2);
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const ctx=c.getContext('2d',{alpha:false});
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(bmp, dx, dy, dw, dh);
    return c;
  }
  if (w>=h){
    const W=2500, scale=W/w, outW=W, outH=Math.round(h*scale);
    const c=document.createElement('canvas'); c.width=outW; c.height=outH;
    const ctx=c.getContext('2d',{alpha:false});
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(bmp, 0, 0, outW, outH);
    return c;
  }
  const H=2000, scale=H/h, outH=H, outW=Math.round(w*scale);
  const c=document.createElement('canvas'); c.width=outW; c.height=outH;
  const ctx=c.getContext('2d',{alpha:false});
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  ctx.drawImage(bmp, 0, 0, outW, outH);
  return c;
}
async function canvasToBlobCapped(canvas, mime){
  const ladder = [0.85, 0.75, 0.65, 0.50, 0.40];
  for (const q of ladder){
    const blob = await new Promise(res=> canvas.toBlob(res, mime, q));
    if (!blob) continue;
    if (blob.size <= 450 * 1024) return blob;
    if (q === ladder[ladder.length-1]) return blob;
  }
}
async function exportDigitalTool(){
  if (!picked.length){
    alert('Seleziona o trascina una cartella con immagini.'); return;
  }

  const files = [...picked].sort((a,b)=> (a.relPath||a.file.name).localeCompare(b.relPath||b.file.name));
  const zip = new JSZip();

  show(ActionProgressWrap); ActionProgress.value = 0;
  const total = files.length; let processed = 0;

  const countsBySlug = new Map();

  for (const rec of files){
    const p = rec.relPath || rec.file.name;
    const relFolder = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';

    let leaf;
    if (relFolder){
      const parts = relFolder.split('/').filter(Boolean);
      leaf = parts.length ? parts[parts.length-1] : '';
    } else {
      const first = (p.includes('/') ? p.split('/')[0] : 'root');
      leaf = first;
    }
    const slug = slugify(leaf);
    if (!countsBySlug.has(slug)) countsBySlug.set(slug, 0);
    const nn = String(countsBySlug.get(slug) + 1).padStart(2,'0');
    countsBySlug.set(slug, countsBySlug.get(slug) + 1);

    const basePath = `_DIGITALTOOL/${relFolder ? relFolder + '/' : ''}`;
    const outBase  = `${basePath}${slug}-${nn}`;

    const bmp = await loadImageBitmap(rec.file);
    const canvas = makeCanvasFromRules(bmp);

    const webp = await canvasToBlobCapped(canvas, 'image/webp');
    const jpg  = await canvasToBlobCapped(canvas, 'image/jpeg');

    if (webp) zip.file(`${outBase}.webp`, webp);
    if (jpg)  zip.file(`${outBase}.jpg`,  jpg);

    processed++; ActionProgress.value = Math.floor((processed/total)*100);
    await sleep(2);
  }

  const ts = new Date();
  const stamp = ts.toISOString().slice(0,10).replace(/-/g,'') + ts.toTimeString().slice(0,5).replace(':','');
  const zipName = `DIGITALTOOL-${stamp}.zip`;

  const blob = await zip.generateAsync({ type:'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = zipName;                  // salva in Download
  document.body.appendChild(a); a.click();
  URL.revokeObjectURL(a.href); a.remove();

  await sleep(250); hide(ActionProgressWrap);
}

/* Smistamento bottone */
BtnProcedi?.addEventListener('click', async ()=>{
  const active = $('#SideMenu li.active')?.dataset.mode;

  if (active === 'images'){ await exportImages(); return; }
  if (active === 'digitaltool'){ await exportDigitalTool(); return; }

  if (!active){ alert('Seleziona una funzione dal menu.'); return; }
  alert('Questa funzione sarà attivata nelle prossime build.');
});
