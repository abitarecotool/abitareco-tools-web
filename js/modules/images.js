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
  const NamePreviewCard = $('#ImageNamePreviewCard');
  const NamePreviewSummary = $('#ImageNamePreviewSummary');
  const NamePreviewGrid = $('#ImageNamePreviewGrid');
  const NamePreviewToggle = $('#ImageNamePreviewToggle');
  const NamePreviewEmpty = $('#ImageNamePreviewEmpty');
  let namePreviewExpanded = false;
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
    const { w, h } = getSelectedFormat();
    const W = Math.max(1, Number(w) || 1);
    const H = Math.max(1, Number(h) || 1);
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

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>\"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }
  function onlyImageRecords(){
    return Array.isArray(picked)
      ? picked.filter(p => p?.file && /\.(jpe?g|png|tif?f|webp)$/i.test(p.file.name || ''))
      : [];
  }
  function getLeafFolder(relPath){
    const p = String(relPath || '').replace(/\\/g, '/');
    if (!p.includes('/')) return '';
    const folder = p.slice(0, p.lastIndexOf('/'));
    const parts = folder.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }
  function splitSlugParts(v){
    return String(v || '').split('-').map(s => s.trim()).filter(Boolean);
  }
  function containsFolderSegment(baseSlug, folderSlug){
    const baseParts = splitSlugParts(baseSlug);
    const folderParts = splitSlugParts(folderSlug);
    if (!baseParts.length || !folderParts.length) return false;
    for (let i = 0; i <= baseParts.length - folderParts.length; i++) {
      let ok = true;
      for (let j = 0; j < folderParts.length; j++) {
        if (baseParts[i + j] !== folderParts[j]) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }
  function buildExportBase(slugBase, folderSlug){
    const base = slugify(slugBase || '');
    const folder = slugify(folderSlug || '');
    if (!base) return folder;
    if (!folder) return base;
    return containsFolderSegment(base, folder) ? base : `${base}-${folder}`;
  }
  function buildNamePreviewModel(folderMap = {}){
    const slugIta = slugify(TxtSlugIta?.value);
    const slugEng = slugify(TxtSlugEng?.value);
    const images = onlyImageRecords();
    const groups = new Map();
    for (const rec of images){
      const leafIta = getLeafFolder(rec.relPath || rec.file?.webkitRelativePath || rec.file?.name || '');
      const key = leafIta || '__ROOT__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(rec);
    }
    return Array.from(groups.entries())
      .sort((a,b) => a[0].localeCompare(b[0], undefined, { numeric:true, sensitivity:'base' }))
      .map(([leafIta, recs]) => {
        const safeLeafIta = leafIta === '__ROOT__' ? '' : leafIta;
        const leafEng = safeLeafIta ? (folderMap[String(safeLeafIta).trim().toLowerCase()] || safeLeafIta) : '';
        recs = recs.slice().sort((a,b)=> (a.relPath || a.file.name).localeCompare((b.relPath || b.file.name), undefined, { numeric:true }));
        const baseIta = buildExportBase(slugIta, safeLeafIta);
        const baseEng = buildExportBase(slugEng, leafEng);
        return {
          key: safeLeafIta || 'generale',
          count: recs.length,
          folderIta: safeLeafIta,
          folderEng: leafEng,
          baseIta,
          baseEng,
          examplesIta: recs.slice(0, Math.max(3, namePreviewExpanded ? recs.length : 3)).map((_, idx) => `${baseIta}-${String(idx + 1).padStart(2,'0')}`),
          examplesEng: recs.slice(0, Math.max(3, namePreviewExpanded ? recs.length : 3)).map((_, idx) => `${baseEng}-${String(idx + 1).padStart(2,'0')}`),
          allShown: namePreviewExpanded || recs.length <= 3
        };
      });
  }
  let folderMapCachePromise = null;
  async function ensureFolderMap(){
    if (!folderMapCachePromise) folderMapCachePromise = loadFolderMap();
    try { return await folderMapCachePromise; } catch { return {}; }
  }
  function renderPreviewCards(models){
    if (!NamePreviewGrid) return;
    if (!models.length){
      NamePreviewGrid.innerHTML = '';
      return;
    }
    NamePreviewGrid.innerHTML = models.map(model => {
      const folderLabel = model.folderIta ? escapeHtml(model.folderIta) : 'Nessuna sottocartella';
      const countLabel = `${model.count} ${model.count === 1 ? 'immagine' : 'immagini'}`;
      const ita = model.examplesIta.map(name => `<span class="platform-generated-name image-naming-chip">${escapeHtml(name)}</span>`).join('');
      const eng = model.examplesEng.map(name => `<span class="platform-generated-name image-naming-chip">${escapeHtml(name)}</span>`).join('');
      const extra = (!model.allShown && model.count > 3)
        ? `<div class="muted image-naming-more">+${model.count - 3} altri nomi disponibili</div>`
        : '';
      return `
        <article class="platform-format-card image-naming-card">
          <div class="platform-format-top">
            <div>
              <h4>${folderLabel}</h4>
              <div class="muted">${countLabel}</div>
            </div>
            <span class="image-naming-badge">${escapeHtml(model.baseIta || model.baseEng || 'preview')}</span>
          </div>
          <div class="image-naming-block">
            <strong>ITA</strong>
            <div class="image-naming-chiplist">${ita || `<span class="muted">Compila lo slug ITA per vedere l’anteprima.</span>`}</div>
          </div>
          <div class="image-naming-block">
            <strong>ENG</strong>
            <div class="image-naming-chiplist">${eng || `<span class="muted">Compila lo slug ENG per vedere l’anteprima.</span>`}</div>
          </div>
          ${extra}
        </article>`;
    }).join('');
  }
  async function renderNamePreview(){
    if (!NamePreviewCard || currentMode !== 'images') {
      try { hideEl(NamePreviewCard); } catch {}
      return;
    }
    const images = onlyImageRecords();
    if (!images.length){
      try { hideEl(NamePreviewCard); } catch {}
      return;
    }
    try { showEl(NamePreviewCard); } catch {}
    const folderMap = await ensureFolderMap();
    const models = buildNamePreviewModel(folderMap);
    const total = models.reduce((sum, item) => sum + item.count, 0);
    const groups = models.length;
    if (NamePreviewSummary) {
      NamePreviewSummary.innerHTML = `<strong>${groups}</strong> ${groups === 1 ? 'gruppo rilevato' : 'gruppi rilevati'} · <strong>${total}</strong> ${total === 1 ? 'immagine' : 'immagini'} pronte per l’export`;
    }
    if (NamePreviewEmpty) {
      const empty = (!slugify(TxtSlugIta?.value) || !slugify(TxtSlugEng?.value));
      NamePreviewEmpty.innerHTML = empty
        ? 'Compila gli slug ITA/ENG per vedere i nomi finali completi. L’anteprima si aggiorna in tempo reale.'
        : 'Anteprima live dei nomi finali. I doppioni del nome cartella vengono rimossi automaticamente in esportazione.';
    }
    if (NamePreviewToggle) {
      const hasHidden = models.some(m => m.count > 3);
      NamePreviewToggle.classList.toggle('hidden', !hasHidden);
      NamePreviewToggle.setAttribute('aria-expanded', namePreviewExpanded ? 'true' : 'false');
      NamePreviewToggle.textContent = namePreviewExpanded ? 'Mostra meno' : 'Mostra tutti';
    }
    renderPreviewCards(models);
  }
  NamePreviewToggle?.addEventListener('click', () => {
    namePreviewExpanded = !namePreviewExpanded;
    renderNamePreview();
  });
  [TxtSlugIta, TxtSlugEng].forEach(el => {
    el?.addEventListener('input', () => { renderNamePreview(); });
    el?.addEventListener('change', () => { renderNamePreview(); });
  });
  document.getElementById('BtnClearPath')?.addEventListener('click', () => {
    namePreviewExpanded = false;
    setTimeout(() => { renderNamePreview(); }, 0);
  });

  // --------- LOGICA SINGLE vs BATCH (crop solo in modalità Immagini) ---------
  function handleCropUI(){
    try { renderNamePreview(); } catch {}
    if (currentMode !== 'images') {
      try { hideEl(ImageCropCard); } catch {}
      return;
    }
    const shouldCrop = (picked.length === 1 && picked[0]?.file && picked[0].file.type?.startsWith('image/') && !!FmtCustom?.checked);
    if (shouldCrop) {
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
// Bitmap con orientamento EXIF (risolve foto verticali "ruotate" che risultano width>height)
async function loadBitmapOriented(file){
  try {
    // Supportato su Chrome/Edge moderni
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // fallback al loader esistente
    return await loadImageBitmap(file);
  }
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
      const baseIta = buildExportBase(slugIta, leafIta);
      const baseEng = buildExportBase(slugEng, leafEng);
      recs.sort((a,b)=> (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true }));
      let counter = 0;
      for (const rec of recs){
        counter++;
        const nn = String(counter).padStart(2,'0');
        const outIta = `${baseIta}-${nn}`;
        const outEng = `${baseEng}-${nn}`;
        const bmp = await loadBitmapOriented(rec.file);
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
  try { renderNamePreview(); } catch {}
  // Esponi API globali richieste dal core
  window.handleCropUI = handleCropUI;
  window.toggleCustomRow = toggleCustomRow;
  window.getSelectedFormat = getSelectedFormat;
  window.updateCropFrameRatio = updateCropFrameRatio;
  window.exportImages = exportImages;
  window.renderImageNamePreview = renderNamePreview;
  /* refresh crop visibility when format changes */
  [Fmt1920, FmtShare, FmtCustom].forEach(r => {
    r?.addEventListener('change', () => { try { handleCropUI(); } catch {} });
    r?.addEventListener('click',  () => { try { handleCropUI(); } catch {} });
  });
})();