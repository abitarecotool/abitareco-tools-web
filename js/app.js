/* =========================================================
   Abitare Co. – Digital Content Tool (Web)
   app.js — Immagini Sito: drag&drop directory → ZIP (ITA/ENG · JPG/WEBP)
   ========================================================= */

/* ----- Helpers base ----- */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const show = (el) => el && el.classList.remove('hidden');
const hide = (el) => el && el.classList.add('hidden');

const getText = (el) => (el && typeof el.value === 'string') ? el.value.trim() : '';
const getNumber = (el, fallback = 0) => {
  const n = Number(getText(el));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ----- Riferimenti DOM ----- */
const sideMenu = $('#SideMenu');
const uploadCard = $('#UploadCard');
const slugCard = $('#SlugCard');
const formatCard = $('#FormatCard');
const videoCard = $('#VideoCard');
const bvCard = $('#BusinessCardCard');
const qrCard = $('#QrCard');
const iubCard = $('#IubendaCard');
const welcomeCard = $('#WelcomeCard');

const actionProgressWrap = $('#ActionProgressWrap');
const actionProgress = $('#ActionProgress');
const btnProcedi = $('#BtnProcedi');

const dropArea = $('#DropArea');
const txtFolder = $('#TxtFolderPath');
const btnClearPath = $('#BtnClearPath');

const txtSlugIta = $('#TxtSlugIta');
const txtSlugEng = $('#TxtSlugEng');

const fmt1920 = $('#FmtSite1920');
const fmtShare = $('#FmtSiteShare');
const fmtCustom = $('#FmtSiteCustom');
const customRow = $('#CustomSizeRow');
const customW = $('#CustomW');
const customH = $('#CustomH');

/* Stato */
let selectedMenuIndex = 0;  // partiamo su "Immagini Sito"
let filesPicked = [];       // [{file: File, relPath: 'sub/folder/img.jpg'}]

/* Collezione card */
const ALL_CARDS = [welcomeCard, uploadCard, slugCard, formatCard, videoCard, bvCard, qrCard, iubCard];

/* =========================================================
   Navigazione
   ========================================================= */
function selectMenu(index) {
  selectedMenuIndex = index;
  ALL_CARDS.forEach(hide);

  if (index < 0) { show(welcomeCard); return; }

  // Default: upload + slug per 0/1
  show(uploadCard);
  if (index === 0 || index === 1) show(slugCard);

  // Formato solo per 0
  if (index === 0) show(formatCard);

  // Video (5)
  if (index === 5) { show(videoCard); hide(slugCard); }

  // BV (7)
  if (index === 7) { hide(uploadCard); hide(slugCard); hide(formatCard); show(bvCard); }

  // QR (8)
  if (index === 8) { hide(uploadCard); hide(slugCard); hide(formatCard); show(qrCard); }

  // Iubenda (9)
  if (index === 9) { hide(uploadCard); hide(slugCard); hide(formatCard); show(iubCard); }

  $$('#SideMenu li').forEach(li => li.classList.remove('active'));
  const active = $(`#SideMenu li[data-index="${index}"]`);
  if (active) active.classList.add('active');
}
selectMenu(0);

sideMenu?.addEventListener('click', (e) => {
  const li = e.target.closest('li'); if (!li) return;
  selectMenu(parseInt(li.dataset.index, 10));
});

/* =========================================================
   Drag&Drop di cartelle con percorso relativo (webkitGetAsEntry)
   ========================================================= */
function dropPreventDefaults(e){ e.preventDefault(); e.stopPropagation(); }
['dragenter','dragover','dragleave','drop'].forEach(ev => dropArea?.addEventListener(ev, dropPreventDefaults));
dropArea?.addEventListener('dragenter', () => dropArea.classList.add('focus'));
dropArea?.addEventListener('dragleave', () => dropArea.classList.remove('focus'));
dropArea?.addEventListener('drop', async (e) => {
  dropArea.classList.remove('focus');
  filesPicked = await readDroppedDirectory(e.dataTransfer);
  const n = filesPicked.length;
  txtFolder.textContent = n ? `Selezionati ${n} file…` : 'Nessun file supportato.';
  btnClearPath?.classList.toggle('hidden', n === 0);
});
btnClearPath?.addEventListener('click', () => {
  filesPicked = [];
  txtFolder.textContent = 'Trascina qui la cartella...';
  btnClearPath.classList.add('hidden');
});

/* Legge ricorsivamente i file da DataTransfer (cartelle incluse) */
async function readDroppedDirectory(dt){
  const items = dt?.items ? Array.from(dt.items) : [];
  const out = [];

  async function traverseEntry(entry, basePath=''){
    if (entry.isFile){
      const file = await new Promise(res => entry.file(res));
      if (/\.(jpe?g|png|tif?f)$/i.test(file.name)){
        out.push({ file, relPath: basePath ? `${basePath}/${file.name}` : file.name });
      }
    } else if (entry.isDirectory){
      const reader = entry.createReader();
      const entries = await new Promise(res => reader.readEntries(res));
      for (const en of entries){
        await traverseEntry(en, basePath ? `${basePath}/${entry.name}` : entry.name);
      }
    }
  }

  // Se l'utente trascina direttamente file (non cartella), gestiscili uguale
  const files = dt?.files ? Array.from(dt.files) : [];
  const hasEntriesAPI = items.length && typeof items[0].webkitGetAsEntry === 'function';

  if (hasEntriesAPI){
    for (const item of items){
      const entry = item.webkitGetAsEntry();
      if (entry) await traverseEntry(entry, '');
    }
  } else {
    for (const f of files){
      if (/\.(jpe?g|png|tif?f)$/i.test(f.name)){
        // Senza path disponibile → mettiamo solo il nome
        out.push({ file: f, relPath: f.name });
      }
    }
  }
  return out;
}

/* =========================================================
   FORMATO (Immagini Sito)
   ========================================================= */
function toggleCustomRow(){ fmtCustom?.checked ? show(customRow) : hide(customRow); }
[fmt1920, fmtShare, fmtCustom].forEach(r => r?.addEventListener('change', toggleCustomRow));
toggleCustomRow();

function getSelectedSiteFormat(){
  if (fmtCustom?.checked){
    const w = getNumber(customW, 1920), h = getNumber(customH, 1080);
    return { w, h, preset:'custom' };
  }
  if (fmtShare?.checked) return { w:1200, h:630, preset:'share' };
  return { w:1920, h:1080, preset:'1920x1080' };
}

/* =========================================================
   Utility naming & slug (coerenti al tool)
   ========================================================= */
function slugify(t){
  if (!t) return '';
  t = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  t = t.replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  return t;
}
function appendOnce(base, suffix){
  const b = slugify(base), s = slugify(suffix);
  if (!s) return b;
  return (b.endsWith('-'+s)) ? b : `${b}-${s}`;
}
function appendSlugFolderUnique(base, folder){ return appendOnce(base, folder); }

/* Carica mappa IT→EN (facoltativa) */
async function loadFolderMap(){
  try{
    const res = await fetch('./assets/folder_map.csv', {cache:'no-store'});
    if (!res.ok) return {};
    const text = await res.text();
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if (!lines.length) return {};
    const header = lines[0].split(',').map(h=>h.trim().toLowerCase());
    const iITA = header.findIndex(h => ['ita','it'].includes(h));
    const iENG = header.findIndex(h => ['eng','en'].includes(h));
    if (iITA<0 || iENG<0) return {};
    const map = {};
    for (let i=1;i<lines.length;i++){
      const cols = lines[i].split(',');
      const ita = (cols[iITA]||'').trim().toLowerCase();
      const eng = (cols[iENG]||'').trim();
      if (ita && eng) map[ita] = eng;
    }
    return map;
  }catch{ return {}; }
}

/* =========================================================
   Canvas helpers (resize + crop centrato)
   ========================================================= */
async function loadImageBitmap(file){
  const url = URL.createObjectURL(file);
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  URL.revokeObjectURL(url);
  return bmp;
}
function drawCoverToCanvas(bmp, targetW, targetH){
  const canvas = document.createElement('canvas');
  canvas.width = targetW; canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  const scale = Math.max(targetW / bmp.width, targetH / bmp.height);
  const dw = bmp.width * scale, dh = bmp.height * scale;
  const dx = (targetW - dw) / 2, dy = (targetH - dh) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, dx, dy, dw, dh);
  return canvas;
}
function canvasToBlob(canvas, mime, quality=0.85){
  return new Promise(res => canvas.toBlob(res, mime, quality));
}

/* =========================================================
   Export — Immagini Sito → ZIP autoscaricato
   ========================================================= */
async function exportImagesSito(){
  const slugIta = slugify(getText(txtSlugIta));
  const slugEng = slugify(getText(txtSlugEng));
  if (!slugIta || !slugEng){ alert('Inserisci gli slug ITA/ENG.'); return; }
  if (!filesPicked || filesPicked.length === 0){ alert('Trascina una cartella con immagini.'); return; }

  const { w:targetW, h:targetH } = getSelectedSiteFormat();
  const folderMap = await loadFolderMap(); // {} se assente

  // Raggruppa per cartella relativa (serve numerazione per cartella)
  const groups = new Map(); // relFolder -> Array<FileRec>
  for (const rec of filesPicked){
    const p = rec.relPath || rec.file.name;
    const relFolder = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
    if (!groups.has(relFolder)) groups.set(relFolder, []);
    groups.get(relFolder).push(rec);
  }

  // ZIP
  const zip = new JSZip();
  const paths = {
    itaJpg: '_EXPORT_SITO/ITA/JPG/',
    itaWebp: '_EXPORT_SITO/ITA/WEBP/',
    engJpg: '_EXPORT_SITO/ENG/JPG/',
    engWebp: '_EXPORT_SITO/ENG/WEBP/'
  };

  // Progress
  show(actionProgressWrap);
  actionProgress.value = 0;
  const total = filesPicked.length;
  let processed = 0;

  for (const [relFolder, recs] of groups){
    // Foglia cartella (o 'hero' se root)
    let leaf = '';
    if (relFolder){
      const parts = relFolder.split('/').filter(Boolean);
      leaf = (parts.length ? parts[parts.length-1] : '').toLowerCase();
    }
    const leafIta = leaf || 'hero';
    const leafEng = folderMap[leafIta] || leafIta;

    const slugFolderIta = slugify(leafIta);
    const slugFolderEng = slugify(leafEng);

    // Ordina stabilmente, poi numerazione locale
    recs.sort((a,b)=> (a.relPath||a.file.name).localeCompare(b.relPath||b.file.name));
    let counter = 0;

    for (const rec of recs){
      counter++;
      const nn = String(counter).padStart(2,'0');

      const baseIta = appendSlugFolderUnique(slugIta, slugFolderIta);
      const baseEng = appendSlugFolderUnique(slugEng, slugFolderEng);
      const outIta = `${baseIta}-${nn}`;
      const outEng = `${baseEng}-${nn}`;

      const bmp = await loadImageBitmap(rec.file);
      const canvas = drawCoverToCanvas(bmp, targetW, targetH);

      const webp = await canvasToBlob(canvas, 'image/webp', 0.85);
      const jpg  = await canvasToBlob(canvas, 'image/jpeg', 0.85);

      zip.file(`${paths.itaWebp}${outIta}.webp`, webp);
      zip.file(`${paths.itaJpg}${outIta}.jpg`,  jpg);
      zip.file(`${paths.engWebp}${outEng}.webp`, webp);
      zip.file(`${paths.engJpg}${outEng}.jpg`,   jpg);

      processed++;
      actionProgress.value = Math.floor((processed/total)*100);
      await sleep(4);
    }
  }

  const now = new Date();
  const stamp = now.toISOString().slice(0,10).replace(/-/g,'') + now.toTimeString().slice(0,5).replace(':','');
  const zipName = `EXPORT_SITO-${slugIta || 'site'}-${stamp}.zip`;

  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();

  await sleep(300);
  hide(actionProgressWrap);
}

/* =========================================================
   Pulsante "Esporta ora"
   ========================================================= */
btnProcedi?.addEventListener('click', async () => {
  if (selectedMenuIndex !== 0){
    alert('In questa build è attivo solo “Immagini Sito”.');
    return;
  }
  await exportImagesSito();
});
