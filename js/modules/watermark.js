/* ========================= WATERMARK (presets) ========================= */
// Fix UX:
// - Nasconde SOLO il box globale "Carica cartella" (UploadCard) quando sei in Watermark.
// - In Watermark usa SOLO gli upload interni: Portali / Coming soon.
// - Coming soon: export ITA/ENG in cartelle separate JPG/WEBP + anteprima nomi.
// - Coming soon: effetti separati e indipendenti (blur / velina / testo).
(function(){
  'use strict';

  /* ---------- CSS safe inject ---------- */
  const STYLE_ID = 'WmHideUploadCardStyle';
  if (!document.getElementById(STYLE_ID)){
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      body.wm-hide-uploadcard #UploadCard{ display:none !important; }
      #WmComingsoonUploadWrap .wm-coming-options{ display:flex; flex-wrap:wrap; gap:10px; margin:0 0 12px; }
      #WmComingsoonUploadWrap .wm-coming-options label{ display:flex; align-items:center; gap:8px; margin-bottom:0; font-weight:500; cursor:pointer; padding:10px 12px; border:1px solid var(--gray-200); border-radius:10px; background:var(--white); }
      #WmComingsoonUploadWrap .wm-coming-options label:hover{ border-color:var(--red); background:var(--pink-bg); }
      #WmComingsoonUploadWrap .wm-coming-options input{ margin:0; }
      #WmNamePreviewCard .platform-upload-big{ border:1px solid var(--gray-200); border-radius:18px; background:var(--white); box-shadow:var(--shadow-sm); padding:18px; }
      @media (max-width: 680px){
        #WmComingsoonUploadWrap .wm-coming-options label{ width:100%; justify-content:flex-start; }
      }
    `;
    document.head.appendChild(st);
  }

  function setBodyHideUpload(on){
    document.body.classList.toggle('wm-hide-uploadcard', !!on);
  }
  function installSelectModeHook(){
    if (!window.selectMode || window.selectMode.__wmHooked) return false;
    const original = window.selectMode;
    const wrapped = function(mode){
      const res = original.apply(this, arguments);
      try {
        const m = (mode || window.currentMode || '').toString();
        setBodyHideUpload(m === 'watermark');
      } catch {}
      return res;
    };
    wrapped.__wmHooked = true;
    wrapped.__wmOriginal = original;
    window.selectMode = wrapped;
    return true;
  }
  let tries = 0;
  const hookTimer = setInterval(() => {
    tries++;
    if (installSelectModeHook() || tries > 40){
      clearInterval(hookTimer);
      try { setBodyHideUpload((window.currentMode || '') === 'watermark'); } catch {}
    }
  }, 100);
  document.addEventListener('click', (e) => {
    const li = e.target && e.target.closest ? e.target.closest('#SideMenu li[data-mode]') : null;
    if (!li) return;
    const mode = li.getAttribute('data-mode');
    setTimeout(() => setBodyHideUpload(mode === 'watermark'), 0);
  }, true);

  /* ---------- Watermark UI ---------- */
  const pills = document.getElementById('WmPresetPills');
  const portaliWrap = document.getElementById('WmPortaliUploadWrap');
  const comingWrap  = document.getElementById('WmComingsoonUploadWrap');

  const portaliDrop = document.getElementById('WmPortaliDrop');
  const portaliName = document.getElementById('WmPortaliName');
  const portaliClear= document.getElementById('WmPortaliClear');

  const comingDrop  = document.getElementById('WmComingsoonDrop');
  const comingName  = document.getElementById('WmComingsoonName');
  const comingClear = document.getElementById('WmComingsoonClear');
  const comingSlugIta = document.getElementById('WmComingSlugIta');
  const comingSlugEng = document.getElementById('WmComingSlugEng');
  const comingBlur = document.getElementById('WmComingBlur');
  const comingVelina = document.getElementById('WmComingVelina');
  const comingText = document.getElementById('WmComingText');

  const namePreviewCard = document.getElementById('WmNamePreviewCard');
  const namePreviewSummary = document.getElementById('WmNamePreviewSummary');
  const namePreviewGrid = document.getElementById('WmNamePreviewGrid');
  const namePreviewEmpty = document.getElementById('WmNamePreviewEmpty');
  const previewExpandedByGroup = Object.create(null);
  const previewEnabledByGroup = Object.create(null);

  const cropWrap  = document.getElementById('WmCropWrap');
  const cropFrame = document.getElementById('WmCropFrame');
  const cropImg   = document.getElementById('WmCropImg');
  const cropZoom  = document.getElementById('WmCropZoom');
  const cropReset = document.getElementById('WmCropReset');

  let wmPreset = 'portali';
  let wmPicked = []; // [{file, relPath}]
  let cropSrcUrl = '';
  let folderMapCachePromise = null;

  const crop = {
    x: 0, y: 0, scale: 1,
    minScale: 0.01, maxScale: 4,
    coverScale: 1, containScale: 1,
    dragging: false, startX: 0, startY: 0,
    pointerId: null
  };

  function clamp(v, a, b){ return Math.min(b, Math.max(a, v)); }
  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[s]));
  }
  function slugBase(value){
    try {
      if (typeof window.slugify === 'function') return window.slugify(value || '');
    } catch {}
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }
  function paintRangeFill(slider, pct){
    if (!slider) return;
    const safe = Math.max(0, Math.min(100, Number(pct) || 0));
    slider.style.setProperty('--fill', safe + '%');
    slider.style.background = `linear-gradient(to right, var(--red) 0 ${safe}%, var(--gray-200) ${safe}% 100%)`;
  }
  function updateZoomTrack(){
    if (!cropZoom) return;
    const min = Number(cropZoom.min) || 0;
    const max = Number(cropZoom.max) || 1;
    const val = Number(cropZoom.value) || min;
    const pct = (max > min) ? ((val - min) / (max - min)) * 100 : 0;
    paintRangeFill(cropZoom, pct);
  }
  function normalizeZipName(name){
    let out = String(name || '').trim();
    out = out.replace(/\.{2,}zip$/i, '.zip');
    if (!/\.zip$/i.test(out)) out += '.zip';
    return out;
  }
  function isMobileGalleryPicker(){
    return window.matchMedia('(max-width: 900px)').matches && (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''));
  }
  function toRec(file, relPath){
    return { file, relPath: relPath || file.name };
  }
  function getImagesOnly(){
    return (wmPicked || []).filter(r => /\.(jpe?g|png|tif?f|webp)$/i.test(r.file?.name || ''));
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
    for (let i = 0; i <= (baseParts.length - folderParts.length); i++){
      let ok = true;
      for (let j = 0; j < folderParts.length; j++){
        if (baseParts[i + j] !== folderParts[j]) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }
  function buildExportBase(baseSlug, folderSlug){
    const base = slugBase(baseSlug || '');
    const folder = slugBase(folderSlug || '');
    if (!base) return folder;
    if (!folder) return base;
    return containsFolderSegment(base, folder) ? base : `${base}-${folder}`;
  }
  function previewGroupKeyFromLeaf(leaf){
    return leaf ? (slugBase(leaf) || leaf) : '__ROOT__';
  }
  function previewGroupEnabled(key){
    return previewEnabledByGroup[key] !== false;
  }
  function ensurePreviewGroupState(keys){
    for (const key of keys || []){
      if (!(key in previewEnabledByGroup)) previewEnabledByGroup[key] = true;
      if (!(key in previewExpandedByGroup)) previewExpandedByGroup[key] = false;
    }
  }
  function eyeIcon(hidden=false){
    return hidden
      ? `<span class="eye-open hidden" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 12S5.5 5.5 12 5.5 22.5 12 22.5 12 18.5 18.5 12 18.5 1.5 12 1.5 12Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg></span><span class="eye-closed" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3L21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.88 5.09A10.94 10.94 0 0 1 12 4.9c6.5 0 10.5 7.1 10.5 7.1a21.47 21.47 0 0 1-4.31 4.91" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.61 6.61A21.48 21.48 0 0 0 1.5 12s4 7.1 10.5 7.1a10.9 10.9 0 0 0 5.03-1.21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
      : `<span class="eye-open" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 12S5.5 5.5 12 5.5 22.5 12 22.5 12 18.5 18.5 12 18.5 1.5 12 1.5 12Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg></span><span class="eye-closed hidden" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3L21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.88 5.09A10.94 10.94 0 0 1 12 4.9c6.5 0 10.5 7.1 10.5 7.1a21.47 21.47 0 0 1-4.31 4.91" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.61 6.61A21.48 21.48 0 0 0 1.5 12s4 7.1 10.5 7.1a10.9 10.9 0 0 0 5.03-1.21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  }
  function resetPreviewState(){
    Object.keys(previewExpandedByGroup).forEach(k => delete previewExpandedByGroup[k]);
    Object.keys(previewEnabledByGroup).forEach(k => delete previewEnabledByGroup[k]);
  }

  function clearSelection(){
    wmPicked = [];
    if (portaliName) portaliName.textContent = isMobileGalleryPicker() ? 'Tocca per selezionare più immagini…' : 'Trascina qui la cartella o clicca per sfogliare…';
    portaliClear?.classList.add('hidden');
    if (comingName) comingName.textContent = isMobileGalleryPicker() ? 'Tocca per selezionare più immagini…' : 'Trascina qui la cartella/singola immagine o clicca per sfogliare…';
    comingClear?.classList.add('hidden');
    hideCropUI();
    resetPreviewState();
    renderNamePreview();
  }
  function setPreset(p){
    wmPreset = p || 'portali';
    if (pills){
      pills.querySelectorAll('[data-wm-preset]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-wm-preset') === wmPreset);
      });
    }
    if (portaliWrap) portaliWrap.classList.toggle('hidden', wmPreset !== 'portali');
    if (comingWrap)  comingWrap.classList.toggle('hidden', wmPreset !== 'comingsoon');
    clearSelection();
  }
  pills?.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('[data-wm-preset]') : null;
    if (!btn) return;
    setPreset(btn.getAttribute('data-wm-preset'));
  });
  setPreset('portali');

  /* ---------- File pick ---------- */
  async function readEntry(entry, pathPrefix, out){
    return new Promise((resolve) => {
      try {
        if (entry.isFile){
          entry.file((file) => {
            out.push(toRec(file, (pathPrefix || '') + file.name));
            resolve();
          }, () => resolve());
        } else if (entry.isDirectory){
          const reader = entry.createReader();
          const readBatch = () => {
            reader.readEntries(async (entries) => {
              if (!entries || !entries.length) return resolve();
              for (const e of entries){
                await readEntry(e, (pathPrefix || '') + entry.name + '/', out);
              }
              readBatch();
            }, () => resolve());
          };
          readBatch();
        } else {
          resolve();
        }
      } catch { resolve(); }
    });
  }
  async function getDroppedFiles(e){
    const out = [];
    const items = e.dataTransfer && e.dataTransfer.items ? Array.from(e.dataTransfer.items) : [];
    const hasEntryAPI = items.some(it => it.webkitGetAsEntry);
    if (hasEntryAPI){
      for (const it of items){
        const entry = it.webkitGetAsEntry ? it.webkitGetAsEntry() : null;
        if (entry) await readEntry(entry, '', out);
      }
      if (out.length) return out;
    }
    const files = e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    return files.map(f => toRec(f, f.name));
  }
  function openFolderPicker(callback){
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.webkitdirectory = true;
    inp.directory = true;
    inp.onchange = () => {
      const files = Array.from(inp.files || []);
      callback(files.map(f => toRec(f, f.webkitRelativePath || f.name)));
    };
    inp.click();
  }
  function openFilesPicker(callback){
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.accept = 'image/*,application/pdf';
    inp.onchange = () => {
      const files = Array.from(inp.files || []);
      callback(files.map(f => toRec(f, f.name)));
    };
    inp.click();
  }
  function openImageGalleryPicker(callback){
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.accept = 'image/*';
    inp.onchange = () => {
      const files = Array.from(inp.files || []);
      callback(files.map(f => toRec(f, f.name)));
    };
    inp.click();
  }
  function setPicked(list){
    wmPicked = list || [];
    const n = wmPicked.length;
    if (wmPreset === 'portali'){
      if (portaliName) portaliName.textContent = n ? `${n} file selezionati` : (isMobileGalleryPicker() ? 'Tocca per selezionare più immagini…' : 'Trascina qui la cartella o clicca per sfogliare…');
      portaliClear?.classList.toggle('hidden', !n);
    } else {
      if (comingName) comingName.textContent = n ? `${n} file selezionati` : (isMobileGalleryPicker() ? 'Tocca per selezionare più immagini…' : 'Trascina qui la cartella/singola immagine o clicca per sfogliare…');
      comingClear?.classList.toggle('hidden', !n);
      const imgs = getImagesOnly().filter(r => (r.file.type || '').startsWith('image/'));
      if (imgs.length === 1 && wmPicked.length === 1) showCropUI(imgs[0].file);
      else hideCropUI();
      resetPreviewState();
      renderNamePreview();
    }
  }
  function bindDropArea(dropEl, onPick, clickMode){
    if (!dropEl) return;
    const stop = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
    ['dragenter','dragover','dragleave','drop'].forEach(ev => dropEl.addEventListener(ev, stop));
    dropEl.addEventListener('dragenter', () => dropEl.classList.add('drag-over'));
    dropEl.addEventListener('dragleave', () => dropEl.classList.remove('drag-over'));
    dropEl.addEventListener('drop', async (e) => {
      dropEl.classList.remove('drag-over');
      onPick(await getDroppedFiles(e));
    });
    dropEl.addEventListener('click', () => {
      if (isMobileGalleryPicker()) return openImageGalleryPicker(onPick);
      if (clickMode === 'folder') return openFolderPicker(onPick);
      return openFilesPicker(onPick);
    });
  }
  bindDropArea(portaliDrop, (list) => {
    setPicked((list || []).filter(r => /\.(jpe?g|png|tif?f|webp|pdf)$/i.test(r.file.name)));
  }, 'folder');
  bindDropArea(comingDrop, (list) => {
    setPicked((list || []).filter(r => /\.(jpe?g|png|tif?f|webp)$/i.test(r.file.name)));
  }, 'files');
  portaliClear?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clearSelection(); });
  comingClear?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clearSelection(); });

  /* ---------- Crop UI ---------- */
  function updateCropTransform(){
    if (!cropImg) return;
    cropImg.style.transform = `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${crop.scale})`;
  }
  function refreshCropConstraints(){
    if (!cropFrame || !cropImg) return;
    const iw = cropImg.naturalWidth || 0;
    const ih = cropImg.naturalHeight || 0;
    if (!iw || !ih) return;
    const rect = cropFrame.getBoundingClientRect();
    const frameW = Math.max(1, rect.width);
    const frameH = Math.max(1, rect.height);
    crop.containScale = Math.max(0.01, Math.min(frameW / iw, frameH / ih));
    crop.coverScale = Math.max(crop.containScale, Math.max(frameW / iw, frameH / ih));
    crop.minScale = crop.containScale;
    crop.maxScale = Math.max(crop.coverScale * 3, crop.minScale * 3, crop.minScale + 0.01);
    if (cropZoom){
      cropZoom.min = String(crop.minScale);
      cropZoom.max = String(crop.maxScale);
      cropZoom.step = String((crop.maxScale - crop.minScale) / 200 || 0.01);
    }
    crop.scale = clamp(crop.scale || crop.coverScale, crop.minScale, crop.maxScale);
    if (cropZoom) cropZoom.value = String(crop.scale);
    updateZoomTrack();
    updateCropTransform();
  }
  function resetCrop(){
    crop.x = 0; crop.y = 0;
    crop.scale = crop.coverScale || 1;
    crop.scale = clamp(crop.scale, crop.minScale, crop.maxScale);
    if (cropZoom) cropZoom.value = String(crop.scale);
    updateZoomTrack();
    updateCropTransform();
  }
  function showCropUI(file){
    if (!cropWrap || !cropImg) return;
    cropWrap.classList.remove('hidden');
    try {
      cropFrame.style.setProperty('--crop-ratio', '1920 / 1080');
      cropFrame.style.aspectRatio = '1920 / 1080';
    } catch {}
    try { if (cropSrcUrl) URL.revokeObjectURL(cropSrcUrl); } catch {}
    cropSrcUrl = URL.createObjectURL(file);
    cropImg.onload = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        refreshCropConstraints();
        resetCrop();
      }));
    };
    cropImg.src = cropSrcUrl;
  }
  function hideCropUI(){
    cropWrap?.classList.add('hidden');
    try { if (cropSrcUrl) URL.revokeObjectURL(cropSrcUrl); } catch {}
    cropSrcUrl = '';
  }
  cropFrame?.addEventListener('pointerdown', (e) => {
    crop.dragging = true;
    crop.startX = e.clientX; crop.startY = e.clientY; crop.pointerId = e.pointerId;
    try { cropFrame.setPointerCapture(e.pointerId); } catch {}
  });
  cropFrame?.addEventListener('pointermove', (e) => {
    if (!crop.dragging) return;
    if (crop.pointerId != null && e.pointerId !== crop.pointerId) return;
    crop.x += (e.clientX - crop.startX);
    crop.y += (e.clientY - crop.startY);
    crop.startX = e.clientX; crop.startY = e.clientY;
    updateCropTransform();
  });
  function endPointer(e){
    if (crop.pointerId != null && e.pointerId !== crop.pointerId) return;
    crop.dragging = false;
    try { cropFrame?.releasePointerCapture(crop.pointerId); } catch {}
    crop.pointerId = null;
  }
  cropFrame?.addEventListener('pointerup', endPointer);
  cropFrame?.addEventListener('pointercancel', endPointer);
  cropZoom?.addEventListener('input', () => {
    crop.scale = clamp(Number(cropZoom.value), crop.minScale, crop.maxScale);
    updateZoomTrack();
    updateCropTransform();
  });
  cropReset?.addEventListener('click', () => {
    refreshCropConstraints();
    resetCrop();
  });

  /* ---------- Preview names ---------- */
  async function loadFolderMap(){
    try {
      const res = await fetch('./assets/folder_map.csv', { cache:'no-store' });
      if (!res.ok) return {};
      const txt = await res.text();
      const rows = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (!rows.length) return {};
      const header = rows[0].split(',').map(h => h.trim().toLowerCase());
      const iITA = header.findIndex(h => ['ita','it'].includes(h));
      const iENG = header.findIndex(h => ['eng','en'].includes(h));
      if (iITA < 0 || iENG < 0) return {};
      const map = {};
      for (let i = 1; i < rows.length; i++){
        const cols = rows[i].split(',');
        const ita = (cols[iITA] || '').trim().toLowerCase();
        const eng = (cols[iENG] || '').trim();
        if (ita && eng) map[ita] = eng;
      }
      return map;
    } catch { return {}; }
  }
  async function ensureFolderMap(){
    if (!folderMapCachePromise) folderMapCachePromise = loadFolderMap();
    try { return await folderMapCachePromise; } catch { return {}; }
  }
  function buildNamePreviewModel(folderMap = {}){
    const slugIta = slugBase(comingSlugIta?.value);
    const slugEng = slugBase(comingSlugEng?.value);
    const images = getImagesOnly();
    const groups = new Map();
    for (const rec of images){
      const leafIta = getLeafFolder(rec.relPath || rec.file?.name || '');
      const key = previewGroupKeyFromLeaf(leafIta || '');
      if (!groups.has(key)) groups.set(key, { leafIta: leafIta || '', recs: [] });
      groups.get(key).recs.push(rec);
    }
    ensurePreviewGroupState(Array.from(groups.keys()));
    return Array.from(groups.entries())
      .sort((a, b) => (a[1].leafIta || '').localeCompare((b[1].leafIta || ''), undefined, { numeric:true, sensitivity:'base' }))
      .map(([groupKey, payload]) => {
        const leafIta = payload.leafIta || '';
        const leafEng = leafIta ? (folderMap[String(leafIta).trim().toLowerCase()] || leafIta) : '';
        const recs = payload.recs.slice().sort((a, b) => (a.relPath || a.file.name).localeCompare((b.relPath || b.file.name), undefined, { numeric:true }));
        const baseIta = buildExportBase(slugIta, leafIta);
        const baseEng = buildExportBase(slugEng, leafEng);
        const expanded = !!previewExpandedByGroup[groupKey];
        const visibleCount = expanded ? recs.length : Math.min(3, recs.length);
        return {
          key: groupKey,
          count: recs.length,
          folderIta: leafIta,
          baseIta,
          baseEng,
          enabled: previewGroupEnabled(groupKey),
          examplesIta: recs.slice(0, visibleCount).map((_, idx) => `${baseIta}-${String(idx + 1).padStart(2, '0')}`),
          examplesEng: recs.slice(0, visibleCount).map((_, idx) => `${baseEng}-${String(idx + 1).padStart(2, '0')}`),
          hiddenCount: Math.max(0, recs.length - visibleCount)
        };
      });
  }
  function renderPreviewCards(models){
    if (!namePreviewGrid) return;
    if (!models.length){
      namePreviewGrid.innerHTML = '';
      return;
    }
    namePreviewGrid.innerHTML = models.map(model => {
      const folderLabel = model.folderIta ? escapeHtml(model.folderIta) : 'Nessuna sottocartella';
      const countLabel = `${model.count} ${model.count === 1 ? 'immagine' : 'immagini'}`;
      const ita = model.examplesIta.map(name => `<span class="platform-generated-name image-naming-chip">${escapeHtml(name)}</span>`).join('');
      const eng = model.examplesEng.map(name => `<span class="platform-generated-name image-naming-chip">${escapeHtml(name)}</span>`).join('');
      const moreBtn = model.hiddenCount > 0
        ? `<button type="button" class="image-naming-link" data-naming-expand="${escapeHtml(model.key)}">Mostra altri nomi disponibili</button>`
        : '';
      return `
        <article class="platform-format-card image-naming-card ${model.enabled ? '' : 'is-disabled'}" data-naming-group="${escapeHtml(model.key)}">
          <div class="platform-format-top">
            <div>
              <h4>${folderLabel}</h4>
              <div class="muted">${countLabel}</div>
            </div>
            <button type="button" class="platform-eye-btn" data-naming-toggle="${escapeHtml(model.key)}" title="${model.enabled ? 'Escludi cartella dall’export' : 'Includi cartella nell’export'}" aria-pressed="${model.enabled ? 'true' : 'false'}">${eyeIcon(!model.enabled)}</button>
          </div>
          <div class="image-naming-block">
            <strong>ITA</strong>
            <div class="image-naming-chiplist">${ita || `<span class="muted">Compila il nome ITA per vedere l’anteprima.</span>`}</div>
          </div>
          <div class="image-naming-block">
            <strong>ENG</strong>
            <div class="image-naming-chiplist">${eng || `<span class="muted">Compila il nome ENG per vedere l’anteprima.</span>`}</div>
          </div>
          <div class="image-naming-actions">
            <div class="muted">${model.enabled ? 'Attiva in export' : 'Esclusa dall’export'}</div>
            ${moreBtn}
          </div>
        </article>`;
    }).join('');
  }
  async function renderNamePreview(){
    if (!namePreviewCard || wmPreset !== 'comingsoon') {
      try { hideEl(namePreviewCard); } catch {}
      return;
    }
    const images = getImagesOnly();
    if (!images.length){
      try { hideEl(namePreviewCard); } catch {}
      if (namePreviewGrid) namePreviewGrid.innerHTML = '';
      return;
    }
    try { showEl(namePreviewCard); } catch {}
    const models = buildNamePreviewModel(await ensureFolderMap());
    const total = models.reduce((sum, item) => sum + item.count, 0);
    const activeGroups = models.filter(m => m.enabled).length;
    const activeImages = models.filter(m => m.enabled).reduce((sum, item) => sum + item.count, 0);
    if (namePreviewSummary){
      namePreviewSummary.innerHTML = `<strong>${models.length}</strong> ${models.length === 1 ? 'gruppo rilevato' : 'gruppi rilevati'} · <strong>${total}</strong> ${total === 1 ? 'immagine' : 'immagini'} caricate · <strong>${activeGroups}</strong> ${activeGroups === 1 ? 'gruppo attivo' : 'gruppi attivi'} · <strong>${activeImages}</strong> in export`;
    }
    if (namePreviewEmpty){
      const missingNames = (!slugBase(comingSlugIta?.value) || !slugBase(comingSlugEng?.value));
      namePreviewEmpty.innerHTML = missingNames
        ? 'Compila i nomi ITA/ENG per vedere i nomi finali completi. L’anteprima si aggiorna in tempo reale.'
        : 'Anteprima live dei nomi finali. Puoi escludere singole cartelle dall’export con l’occhiolino senza toccare il crop o gli effetti Coming soon.';
    }
    renderPreviewCards(models);
  }
  [comingSlugIta, comingSlugEng].forEach(el => {
    el?.addEventListener('input', renderNamePreview);
    el?.addEventListener('change', renderNamePreview);
  });
  namePreviewGrid?.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('[data-naming-toggle]');
    if (toggleBtn){
      const key = toggleBtn.dataset.namingToggle || '__ROOT__';
      previewEnabledByGroup[key] = !previewGroupEnabled(key);
      renderNamePreview();
      return;
    }
    const expandBtn = e.target.closest('[data-naming-expand]');
    if (expandBtn){
      const key = expandBtn.dataset.namingExpand || '__ROOT__';
      previewExpandedByGroup[key] = true;
      renderNamePreview();
    }
  });

  /* ---------- Export helpers ---------- */
  async function loadBitmapOriented(file){
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      return await loadImageBitmap(file);
    }
  }
  async function loadFixedWatermarkLogo(){
    try {
      const r = await fetch('./assets/logo-watermark.png', { cache:'no-store' });
      if (r.ok) return await createImageBitmap(await r.blob(), { imageOrientation:'from-image' });
    } catch {}
    try {
      const r = await fetch('./assets/logo.png', { cache:'no-store' });
      if (r.ok) return await createImageBitmap(await r.blob(), { imageOrientation:'from-image' });
    } catch {}
    return null;
  }
  async function loadComingsoonOverlays(){
    const out = { velina:null, testo:null };
    try {
      const r1 = await fetch('./assets/comingsoon/velina.png', { cache:'no-store' });
      if (r1.ok) out.velina = await createImageBitmap(await r1.blob(), { imageOrientation:'from-image' });
    } catch {}
    try {
      const r2 = await fetch('./assets/comingsoon/testo.png', { cache:'no-store' });
      if (r2.ok) out.testo = await createImageBitmap(await r2.blob(), { imageOrientation:'from-image' });
    } catch {}
    return out;
  }
  function drawCoverToCanvas(bmp, W, H){
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const s = Math.max(W / bmp.width, H / bmp.height);
    const dw = Math.round(bmp.width * s);
    const dh = Math.round(bmp.height * s);
    const dx = Math.round((W - dw) / 2);
    const dy = Math.round((H - dh) / 2);
    ctx.drawImage(bmp, dx, dy, dw, dh);
    return c;
  }
  function drawCroppedToCanvas(bmp, W, H){
    try {
      const rect = cropFrame?.getBoundingClientRect?.();
      if (!rect || !rect.width || !rect.height) return drawCoverToCanvas(bmp, W, H);
      const sx = W / rect.width;
      const sy = H / rect.height;
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
  function drawLogoCenter(canvas, logoBmp){
    if (!logoBmp) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const maxSide = Math.min(W, H) * 0.35;
    const lr = logoBmp.width / logoBmp.height;
    const lw = lr >= 1 ? maxSide : Math.round(maxSide * lr);
    const lh = lr >= 1 ? Math.round(lw / lr) : maxSide;
    const x = Math.round((W - lw) / 2);
    const y = Math.round((H - lh) / 2);
    ctx.drawImage(logoBmp, x, y, lw, lh);
  }

  /* ---------- Export portali ---------- */
  async function exportPortali(){
    const images = (wmPicked || []).filter(r => /\.(jpe?g|png|tif?f|webp)$/i.test(r.file.name));
    const pdfs   = (wmPicked || []).filter(r => /\.pdf$/i.test(r.file.name));
    if (!images.length && !pdfs.length){ alert('Carica immagini o PDF.'); return; }
    const logo = await loadFixedWatermarkLogo();
    const zip = new JSZip();
    showEl(ActionProgressWrap);
    ActionProgress.value = 0;
    ActionProgressLabel.textContent = 'Elaborazione…';
    const total = images.length + pdfs.length;
    let done = 0;
    let counterImg = 0;
    for (const rec of images){
      const bmp = await loadBitmapOriented(rec.file);
      const c = drawCoverToCanvas(bmp, 1024, 768);
      drawLogoCenter(c, logo);
      zip.file(`_EXPORT_WATERMARK/immagini/immagini-${String(++counterImg).padStart(2, '0')}.jpg`, await canvasToBlob(c, 'image/jpeg', 0.92));
      ActionProgress.value = Math.round((++done / total) * 100);
    }
    if (pdfs.length){
      await ensurePdfJs();
      for (const rec of pdfs){
        const ab = await rec.file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 300 / 72 });
        const tmp = document.createElement('canvas');
        tmp.width = Math.ceil(viewport.width);
        tmp.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: tmp.getContext('2d'), viewport }).promise;
        const bmp = await createImageBitmap(tmp);
        const c = document.createElement('canvas');
        c.width = 1024; c.height = 768;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 1024, 768);
        const s = Math.min(1024 / bmp.width, 768 / bmp.height);
        const dw = Math.round(bmp.width * s);
        const dh = Math.round(bmp.height * s);
        const dx = Math.round((1024 - dw) / 2);
        const dy = Math.round((768 - dh) / 2);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bmp, dx, dy, dw, dh);
        drawLogoCenter(c, logo);
        zip.file(`_EXPORT_WATERMARK/planimetria/${rec.file.name.replace(/\.pdf$/i, '')}.jpg`, await canvasToBlob(c, 'image/jpeg', 0.92));
        ActionProgress.value = Math.round((++done / total) * 100);
      }
    }
    const blob = await zip.generateAsync({ type:'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = normalizeZipName(`EXPORT_WATERMARK-${Date.now()}.zip`);
    a.click();
    URL.revokeObjectURL(a.href);
    hideEl(ActionProgressWrap);
  }

  /* ---------- Export coming soon ---------- */
  async function exportComingsoon(){
    const slugIta = slugBase(comingSlugIta?.value);
    const slugEng = slugBase(comingSlugEng?.value);
    if (!slugIta || !slugEng){
      alert('Compila i campi Nome file ITA e Nome file ENG.');
      return;
    }
    const images = getImagesOnly();
    if (!images.length){
      alert('Carica la cartella/singola immagine nella sezione Coming soon.');
      return;
    }
    const folderMap = await ensureFolderMap();
    const wantBlur = !!comingBlur?.checked;
    const wantVelina = !!comingVelina?.checked;
    const wantText = !!comingText?.checked;

    let overlays = { velina:null, testo:null };
    if (wantVelina || wantText){
      overlays = await loadComingsoonOverlays();
      if (wantVelina && !overlays.velina){
        alert('Manca assets/comingsoon/velina.png ma la checkbox “Metti la velina” è attiva.');
        return;
      }
      if (wantText && !overlays.testo){
        alert('Manca assets/comingsoon/testo.png ma la checkbox “Metti il testo” è attiva.');
        return;
      }
    }

    const groups = new Map();
    for (const rec of images){
      const path = rec.relPath || rec.file.name;
      const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder).push(rec);
    }
    const exportGroups = Array.from(groups.entries()).filter(([relFolder]) => {
      const parts = String(relFolder || '').split('/').filter(Boolean);
      const leaf = parts.length ? parts[parts.length - 1] : '';
      return previewGroupEnabled(previewGroupKeyFromLeaf(leaf));
    });
    if (!exportGroups.length){
      alert('Attiva almeno una cartella nella preview prima di esportare.');
      return;
    }

    const zip = new JSZip();
    showEl(ActionProgressWrap);
    ActionProgress.value = 0;
    ActionProgressLabel.textContent = 'Elaborazione…';

    const total = exportGroups.reduce((sum, [, recs]) => sum + recs.length, 0);
    let done = 0;
    const useSingleCrop = (images.length === 1 && cropWrap && !cropWrap.classList.contains('hidden'));

    for (const [relFolder, recs] of exportGroups){
      const parts = String(relFolder || '').split('/').filter(Boolean);
      const leafIta = parts.length ? parts[parts.length - 1] : '';
      const leafEng = leafIta ? (folderMap[String(leafIta).trim().toLowerCase()] || leafIta) : '';
      const baseIta = buildExportBase(slugIta, leafIta);
      const baseEng = buildExportBase(slugEng, leafEng);
      recs.sort((a, b) => (a.relPath || a.file.name).localeCompare((b.relPath || b.file.name), undefined, { numeric:true }));
      let counter = 0;
      for (const rec of recs){
        const bmp = await loadBitmapOriented(rec.file);
        const W = 1920, H = 1080;
        const sourceCanvas = useSingleCrop ? drawCroppedToCanvas(bmp, W, H) : drawCoverToCanvas(bmp, W, H);
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (wantBlur){
          ctx.filter = 'blur(5px)';
          ctx.drawImage(sourceCanvas, 0, 0, W, H);
          ctx.filter = 'none';
        } else {
          ctx.drawImage(sourceCanvas, 0, 0, W, H);
        }
        if (wantVelina && overlays.velina){
          ctx.drawImage(overlays.velina, 0, 0, W, H);
        }
        if (wantText && overlays.testo){
          ctx.drawImage(overlays.testo, 0, 0, W, H);
        }

        const nn = String(++counter).padStart(2, '0');
        const outIta = `${baseIta}-${nn}`;
        const outEng = `${baseEng}-${nn}`;
        const outJpg = await canvasToBlob(c, 'image/jpeg', 0.92);
        const outWebp = await canvasToBlob(c, 'image/webp', 0.90);

        zip.file(`_EXPORT_COMINGSOON/ITA/JPG/${outIta}.jpg`, outJpg);
        zip.file(`_EXPORT_COMINGSOON/ITA/WEBP/${outIta}.webp`, outWebp);
        zip.file(`_EXPORT_COMINGSOON/ENG/JPG/${outEng}.jpg`, outJpg);
        zip.file(`_EXPORT_COMINGSOON/ENG/WEBP/${outEng}.webp`, outWebp);

        ActionProgress.value = Math.round((++done / Math.max(total, 1)) * 100);
        ActionProgressLabel.textContent = `Elaborazione… ${done}/${total}`;
      }
    }

    const blob = await zip.generateAsync({ type:'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = normalizeZipName(`EXPORT_COMINGSOON-${slugIta}-${Date.now()}.zip`);
    a.click();
    URL.revokeObjectURL(a.href);
    hideEl(ActionProgressWrap);
  }

  window.exportWatermarkPortali = async function(){
    return (wmPreset === 'comingsoon') ? exportComingsoon() : exportPortali();
  };

  try { renderNamePreview(); } catch {}
})();
