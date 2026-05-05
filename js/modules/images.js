/* =============================== Immagini (Sito) ====================== */

// Modulo isolato (evita collisioni di variabili tra script classici)
(function(){
  'use strict';

  /* --------- CROP MANUALE (SOLO SE 1 IMMAGINE) --------- */

  // elementi DOM
  const ImageCropCard = document.getElementById('ImageCropCard');
  const CropFrame     = document.getElementById('CropFrame');
  const CropImg       = document.getElementById('CropImg');
  const CropReset     = document.getElementById('CropReset');
  const CropZoom      = document.getElementById('CropZoom');

  // stato crop (pan + zoom)
  let crop = {
    x: 0,
    y: 0,
    scale: 1,
    minScale: 0.01,
    maxScale: 4,
    coverScale: 1,
    containScale: 1,
    dragging: false,
    startX: 0,
    startY: 0,
    pointerId: null
  };

  function clamp(v, a, b){ return Math.min(b, Math.max(a, v)); }

  function updateZoomTrack(){
    if (!CropZoom) return;
    const min = Number(CropZoom.min) || 0;
    const max = Number(CropZoom.max) || 1;
    const val = Number(CropZoom.value) || min;
    const pct = (max > min) ? ((val - min) / (max - min)) * 100 : 0;
    CropZoom.style.setProperty('--fill', pct + '%');
  }

  function updateCrop(){
    if (!CropImg) return;
    CropImg.style.transform =
      `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${crop.scale})`;
  }

  function refreshCropConstraints(){
    if (!CropFrame || !CropImg) return;
    const iw = CropImg.naturalWidth || 0;
    const ih = CropImg.naturalHeight || 0;
    if (!iw || !ih) return;

    const rect = CropFrame.getBoundingClientRect();
    const frameW = Math.max(1, rect.width);
    const frameH = Math.max(1, rect.height);

    const contain = Math.min(frameW / iw, frameH / ih);
    const cover   = Math.max(frameW / iw, frameH / ih);

    crop.containScale = Math.max(0.01, contain);
    crop.coverScale   = Math.max(crop.containScale, cover);

    crop.minScale = crop.containScale;
    crop.maxScale = Math.max(crop.coverScale * 3, crop.minScale * 3, crop.minScale + 0.01);

    if (CropZoom){
      CropZoom.min = String(crop.minScale);
      CropZoom.max = String(crop.maxScale);
      const step = (crop.maxScale - crop.minScale) / 200;
      CropZoom.step = String(step > 0 ? step : 0.01);
    }

    crop.scale = clamp(crop.scale || crop.coverScale, crop.minScale, crop.maxScale);
    if (CropZoom) CropZoom.value = String(crop.scale);

    updateZoomTrack();
    updateCrop();
  }

  function resetCrop(mode = 'cover'){
    crop.x = 0;
    crop.y = 0;
    crop.scale = (mode === 'contain') ? crop.containScale : crop.coverScale;
    crop.scale = clamp(crop.scale || 1, crop.minScale, crop.maxScale);
    if (CropZoom) CropZoom.value = String(crop.scale);
    updateZoomTrack();
    updateCrop();
  }

  // Pointer events (mouse + touch)
  CropFrame?.addEventListener('pointerdown', (e) => {
    crop.dragging = true;
    crop.startX = e.clientX;
    crop.startY = e.clientY;
    crop.pointerId = e.pointerId;
    try { CropFrame.setPointerCapture(e.pointerId); } catch {}
  });

  CropFrame?.addEventListener('pointermove', (e) => {
    if (!crop.dragging) return;
    if (crop.pointerId != null && e.pointerId !== crop.pointerId) return;
    crop.x += (e.clientX - crop.startX);
    crop.y += (e.clientY - crop.startY);
    crop.startX = e.clientX;
    crop.startY = e.clientY;
    updateCrop();
  });

  function _endPointer(e){
    if (crop.pointerId != null && e.pointerId !== crop.pointerId) return;
    crop.dragging = false;
    try { CropFrame?.releasePointerCapture(crop.pointerId); } catch {}
    crop.pointerId = null;
  }

  CropFrame?.addEventListener('pointerup', _endPointer);
  CropFrame?.addEventListener('pointercancel', _endPointer);

  CropZoom?.addEventListener('input', () => {
    const v = Number(CropZoom.value);
    crop.scale = clamp(v, crop.minScale, crop.maxScale);
    updateZoomTrack();
    updateCrop();
  });

  CropReset?.addEventListener('click', () => {
    try { refreshCropConstraints(); } catch {}
    resetCrop('cover');
  });

  // --- Formato + Slug ---
  const TxtSlugIta = $('#TxtSlugIta');
  const TxtSlugEng = $('#TxtSlugEng');
  const Fmt1920 = $('#FmtSite1920');
  const FmtShare= $('#FmtSiteShare');
  const FmtCustom=$('#FmtSiteCustom');
  const CustomRow=$('#CustomSizeRow');
  const CustomW = $('#CustomW');
  const CustomH = $('#CustomH');

  function toggleCustomRow(){
    if (!FmtCustom || !CustomRow) return;
    FmtCustom.checked ? showEl(CustomRow) : hideEl(CustomRow);
  }

  [Fmt1920, FmtShare, FmtCustom].forEach(r => {
    r?.addEventListener('change', toggleCustomRow);
    r?.addEventListener('click', toggleCustomRow);
  });

  function getSelectedFormat(){
    if (FmtCustom?.checked){
      return {
        w: Math.max(1, Number(CustomW?.value) || 1920),
        h: Math.max(1, Number(CustomH?.value) || 1080)
      };
    }
    if (FmtShare?.checked) return { w:1200, h:630 };
    return { w:1920, h:1080 };
  }


// Preset: "Sito Abitare Co." (prima opzione)
function isSitePreset(){
  return !!(Fmt1920 && Fmt1920.checked && !(FmtShare && FmtShare.checked) && !(FmtCustom && FmtCustom.checked));
}

// Modalità A
// - Orizzontali: 1920×1080
// - Verticali/Quadrate: altezza 1080, larghezza proporzionale (square => 1080×1080)
function getSiteOutputSize(iw, ih){
  if (!iw || !ih) return { w:1920, h:1080 };
  if (iw > ih) return { w:1920, h:1080 };
  const h = 1080;
  const w = Math.max(1, Math.round(h * (iw / ih)));
  return { w, h };
}

  
function updateCropFrameRatio(){
  if (!CropFrame) return;

  let W = 1, H = 1;
  const sel = getSelectedFormat();
  W = Math.max(1, Number(sel.w) || 1);
  H = Math.max(1, Number(sel.h) || 1);

  // Se è selezionato "Sito Abitare Co." e c'è una sola immagine, adattiamo il ratio all'orientazione
  try {
    if (isSitePreset() && picked && picked.length === 1 && CropImg && CropImg.naturalWidth && CropImg.naturalHeight){
      const o = getSiteOutputSize(CropImg.naturalWidth, CropImg.naturalHeight);
      W = o.w;
      H = o.h;
    }
  } catch {}

  const ratio = `${W} / ${H}`;
  CropFrame.style.setProperty('--crop-ratio', ratio);
  try { CropFrame.style.aspectRatio = ratio; } catch {}
  try {
    const fw = Math.max(1, CropFrame.clientWidth);
    CropFrame.style.height = Math.round(fw * (H / W)) + 'px';
  } catch {}
}
  // aggiorna cornice quando cambia il formato
  [Fmt1920, FmtShare, FmtCustom, CustomW, CustomH].forEach(el => {
    const go = () => {
      try { updateCropFrameRatio(); } catch {}
      try {
        if (ImageCropCard && !ImageCropCard.classList.contains('hidden')) {
          refreshCropConstraints();
          if (CropZoom) { CropZoom.value = String(crop.scale); updateZoomTrack(); }
        }
      } catch {}
    };
    el?.addEventListener('change', go);
    el?.addEventListener('input', go);
  });

  // --------- LOGICA SINGLE vs BATCH (crop solo in modalità Immagini) ---------
  function handleCropUI(){
    if (currentMode !== 'images') {
      try { hideEl(ImageCropCard); } catch {}
      return;
    }

    if (picked.length === 1 && picked[0]?.file && picked[0].file.type?.startsWith('image/')) {
      showEl(ImageCropCard);

      const file = picked[0].file;
      if (!CropImg) return;

      try { updateCropFrameRatio(); } catch {}

      try { if (window.__ABITARE_CROP_URL) URL.revokeObjectURL(window.__ABITARE_CROP_URL); } catch {}
      const url = URL.createObjectURL(file);
      window.__ABITARE_CROP_URL = url;

      CropImg.onload = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try { refreshCropConstraints(); } catch {}
            try { resetCrop('cover'); } catch {}
          });
        });
      };

      CropImg.src = url;
    } else {
      hideEl(ImageCropCard);
    }
  }

  // Export: usa crop se 1 immagine e crop visibile
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


function drawContainToCanvas(bmp, W, H){
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const scale = Math.min(W/bmp.width, H/bmp.height);
  const dw = Math.round(bmp.width * scale);
  const dh = Math.round(bmp.height * scale);
  const dx = Math.round((W - dw) / 2);
  const dy = Math.round((H - dh) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, dx, dy, dw, dh);
  return c;
}

  function drawCroppedToCanvas(bmp, W, H){
    try {
      const rect = CropFrame?.getBoundingClientRect?.();
      if (!rect || !rect.width || !rect.height) return drawCoverToCanvas(bmp, W, H);

      const frameW = rect.width;
      const frameH = rect.height;
      const sx = W / frameW;
      const sy = H / frameH;

      const scaleOut = crop.scale * sx;
      const dxOut = crop.x * sx;
      const dyOut = crop.y * sy;

      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const dw = bmp.width * scaleOut;
      const dh = bmp.height * scaleOut;
      const cx = (W / 2) + dxOut;
      const cy = (H / 2) + dyOut;
      const x = cx - (dw / 2);
      const y = cy - (dh / 2);

      ctx.drawImage(bmp, x, y, dw, dh);
      return c;
    } catch {
      return drawCoverToCanvas(bmp, W, H);
    }
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

  async function exportImages(){
    const slugIta = slugify(TxtSlugIta?.value);
    const slugEng = slugify(TxtSlugEng?.value);
    if (!slugIta || !slugEng){ alert('Compila i campi ITA e ENG.'); return; }

    const images = picked.filter(p => /\.(jpe?g|png|tif?f|webp)$/i.test(p.file.name));
    if (!images.length){ alert('Carica una cartella con immagini.'); return; }

    const { w: baseW, h: baseH } = getSelectedFormat();
    const folderMap = await loadFolderMap();

    const groups = new Map();
    for (const rec of images){
      const p = rec.relPath || rec.file.name;
      const folder = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder).push(rec);
    }

    const zip = new JSZip();
    showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = 'Esportazione in corso…';

    const total = images.length; let processed = 0;

    for (const [relFolder, recs] of groups){
      let leaf = '';
      if (relFolder){
        const parts = relFolder.split('/').filter(Boolean);
        leaf = parts.length ? parts[parts.length-1] : '';
      }
      const leafIta = leaf || '';
      const leafEng = leafIta ? (folderMap[leafIta] || leafIta) : '';

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

// SMART_SITE_DIMENSIONS (Modalità A)
// - Vale SOLO per "Sito Abitare Co." (prima opzione)
// - Orizzontali: 1920×1080 (cover)
// - Verticali/Quadrate: altezza 1080 e larghezza proporzionale (no crop)
let W = baseW, H = baseH;
const sitePreset = isSitePreset();
if (sitePreset){
  const o = getSiteOutputSize(bmp.width, bmp.height);
  W = o.w;
  H = o.h;
}

const useCrop = (currentMode === 'images' && images.length === 1 && ImageCropCard && !ImageCropCard.classList.contains('hidden'));
        const canvas = useCrop ? drawCroppedToCanvas(bmp, W, H) : ((sitePreset && bmp.width <= bmp.height) ? drawContainToCanvas(bmp, W, H) : drawCoverToCanvas(bmp, W, H));

        const webp = await canvasToBlob(canvas, 'image/webp', 0.85);
        const jpg  = await canvasToBlob(canvas, 'image/jpeg', 0.85);

        zip.file(`_EXPORT_SITO/ITA/WEBP/${outIta}.webp`, webp);
        zip.file(`_EXPORT_SITO/ITA/JPG/${outIta}.jpg`,  jpg);
        zip.file(`_EXPORT_SITO/ENG/WEBP/${outEng}.webp`, webp);
        zip.file(`_EXPORT_SITO/ENG/JPG/${outEng}.jpg`,  jpg);

        ActionProgress.value = Math.round((++processed/total)*100);
      }
    }

    const d = new Date();
 const pad = (n)=>String(n).padStart(2,'0');
 const stamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const blob = await zip.generateAsync({type:'blob'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `EXPORT_SITO-${slugIta}-${stamp}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    hideEl(ActionProgressWrap);
  }

  // init: assicura che la riga custom sia coerente appena entri
  try { toggleCustomRow(); } catch {}
  try { updateCropFrameRatio(); } catch {}

  // Esponi API globali richieste dal core
  window.handleCropUI = handleCropUI;
  window.toggleCustomRow = toggleCustomRow;
  window.getSelectedFormat = getSelectedFormat;
  window.updateCropFrameRatio = updateCropFrameRatio;
  window.exportImages = exportImages;
})();