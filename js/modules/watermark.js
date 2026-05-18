/* ========================= WATERMARK (presets) ========================= */
// Fix UX:
// - Nasconde SOLO il box globale "Carica cartella" (UploadCard) quando sei in Watermark,
//   senza toccare classi/visibilità usate dagli altri moduli (evita bug su altre sezioni).
// - In Watermark usa SOLO gli upload interni: Portali / Coming soon.
// - Doppio click su Watermark in sidebar: UploadCard resta nascosto (CSS su body).
//
// Preset 1: Portali immobiliari
//  - Upload interno: cartella (click) o drag&drop cartella
//  - Watermark con assets/logo-watermark.png (fallback logo.png)
//  - Immagini + PDF
// Preset 2: Coming soon sito
//  - Upload interno: cartella o singola immagine (drag&drop) + selezione file (click)
//  - Crop manuale se 1 sola immagine
//  - Output 1920x1080, blur 5px, overlay velina+testo

(function(){
  'use strict';

  // ---------- Inject CSS override (safe) ----------
  const STYLE_ID = 'WmHideUploadCardStyle';
  if (!document.getElementById(STYLE_ID)){
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      body.wm-hide-uploadcard #UploadCard{ display:none !important; }
    `;
    document.head.appendChild(st);
  }

  function setBodyHideUpload(on){
    document.body.classList.toggle('wm-hide-uploadcard', !!on);
  }

  // Hook selectMode (senza toccare core): così il toggle è preciso e non "salta" su altre sezioni.
  function installSelectModeHook(){
    if (!window.selectMode || window.selectMode.__wmHooked) return false;
    const original = window.selectMode;
    const wrapped = function(mode){
      // chiama core
      const res = original.apply(this, arguments);
      // aggiorna dopo che il core ha mostrato/nascosto le card
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

  // tenta subito e poi per poco tempo (nel caso in cui selectMode arrivi dopo)
  let tries = 0;
  const hookTimer = setInterval(() => {
    tries++;
    if (installSelectModeHook() || tries > 40){
      clearInterval(hookTimer);
      // sincronizza allo stato corrente
      try { setBodyHideUpload((window.currentMode || '') === 'watermark'); } catch {}
    }
  }, 100);

  // In caso di click ripetuti sulla stessa voce (alcune UI non richiamano selectMode)
  // aggiorniamo anche su click menu.
  document.addEventListener('click', (e) => {
    const li = e.target && e.target.closest ? e.target.closest('#SideMenu li[data-mode]') : null;
    if (!li) return;
    const mode = li.getAttribute('data-mode');
    setTimeout(() => setBodyHideUpload(mode === 'watermark'), 0);
  }, true);

  // ---------- Watermark UI ----------
  const pills = document.getElementById('WmPresetPills');
  const portaliWrap = document.getElementById('WmPortaliUploadWrap');
  const comingWrap  = document.getElementById('WmComingsoonUploadWrap');

  const portaliDrop = document.getElementById('WmPortaliDrop');
  const portaliName = document.getElementById('WmPortaliName');
  const portaliClear= document.getElementById('WmPortaliClear');

  const comingDrop  = document.getElementById('WmComingsoonDrop');
  const comingName  = document.getElementById('WmComingsoonName');
  const comingClear = document.getElementById('WmComingsoonClear');

  const cropWrap  = document.getElementById('WmCropWrap');
  const cropFrame = document.getElementById('WmCropFrame');
  const cropImg   = document.getElementById('WmCropImg');
  const cropZoom  = document.getElementById('WmCropZoom');
  const cropReset = document.getElementById('WmCropReset');

  let wmPreset = 'portali';
  let wmPicked = []; // [{file, relPath}]
  let cropSrcUrl = '';

  // Crop state
  const crop = {
    x: 0, y: 0, scale: 1,
    minScale: 0.01, maxScale: 4,
    coverScale: 1, containScale: 1,
    dragging: false, startX: 0, startY: 0,
    pointerId: null
  };

  function clamp(v,a,b){ return Math.min(b, Math.max(a,v)); }

  function clearSelection(){
    wmPicked = [];
    // Non tocchiamo window.picked globale per non interferire con altri moduli.
    // Lo useremo solo durante l'export.

    if (portaliName) portaliName.textContent = 'Trascina qui la cartella o clicca per sfogliare…';
    portaliClear?.classList.add('hidden');

    if (comingName) comingName.textContent = 'Trascina qui la cartella/singola immagine o clicca per sfogliare…';
    comingClear?.classList.add('hidden');

    hideCropUI();
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

  if (pills){
    pills.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('[data-wm-preset]') : null;
      if (!btn) return;
      setPreset(btn.getAttribute('data-wm-preset'));
    });
  }
  setPreset('portali');

  // ---------- File pick helpers ----------
  function toRec(file, relPath){
    return { file, relPath: relPath || file.name };
  }

  function setPicked(list){
    wmPicked = list || [];
    const n = wmPicked.length;

    if (wmPreset === 'portali'){
      if (portaliName) portaliName.textContent = n ? `${n} file selezionati` : 'Trascina qui la cartella o clicca per sfogliare…';
      portaliClear?.classList.toggle('hidden', !n);
    } else {
      if (comingName) comingName.textContent = n ? `${n} file selezionati` : 'Trascina qui la cartella/singola immagine o clicca per sfogliare…';
      comingClear?.classList.toggle('hidden', !n);

      // crop se 1 sola immagine
      const imgs = wmPicked.filter(r => /\.(jpe?g|png|tif?f|webp)$/i.test(r.file.name) && (r.file.type || '').startsWith('image/'));
      if (imgs.length === 1 && wmPicked.length === 1) showCropUI(imgs[0].file);
      else hideCropUI();
    }
  }

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
      const list = files.map(f => toRec(f, f.webkitRelativePath || f.name));
      callback(list);
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
      const list = files.map(f => toRec(f, f.name));
      callback(list);
    };
    inp.click();
  }

  function bindDropArea(dropEl, onPick, clickMode){
    if (!dropEl) return;
    const stop = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
    ['dragenter','dragover','dragleave','drop'].forEach(ev => dropEl.addEventListener(ev, stop));
    dropEl.addEventListener('dragenter', () => dropEl.classList.add('drag-over'));
    dropEl.addEventListener('dragleave', () => dropEl.classList.remove('drag-over'));
    dropEl.addEventListener('drop', async (e) => {
      dropEl.classList.remove('drag-over');
      const list = await getDroppedFiles(e);
      onPick(list);
    });
    dropEl.addEventListener('click', () => {
      if (clickMode === 'folder') openFolderPicker(onPick);
      else openFilesPicker(onPick);
    });
  }

  bindDropArea(portaliDrop, (list) => {
    const filtered = (list || []).filter(r => /\.(jpe?g|png|tif?f|webp|pdf)$/i.test(r.file.name));
    setPicked(filtered);
  }, 'folder');

  bindDropArea(comingDrop, (list) => {
    const filtered = (list || []).filter(r => /\.(jpe?g|png|tif?f|webp)$/i.test(r.file.name));
    setPicked(filtered);
  }, 'files');

  portaliClear?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clearSelection(); });
  comingClear?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clearSelection(); });

  // ---------- Crop UI ----------
  function updateZoomTrack(){
    if (!cropZoom) return;
    const min = Number(cropZoom.min) || 0;
    const max = Number(cropZoom.max) || 1;
    const val = Number(cropZoom.value) || min;
    const pct = (max > min) ? ((val - min) / (max - min)) * 100 : 0;
    cropZoom.style.setProperty('--fill', pct + '%');
  }

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

    const contain = Math.min(frameW/iw, frameH/ih);
    const cover = Math.max(frameW/iw, frameH/ih);

    crop.containScale = Math.max(0.01, contain);
    crop.coverScale = Math.max(crop.containScale, cover);
    crop.minScale = crop.containScale;
    crop.maxScale = Math.max(crop.coverScale * 3, crop.minScale * 3, crop.minScale + 0.01);

    if (cropZoom){
      cropZoom.min = String(crop.minScale);
      cropZoom.max = String(crop.maxScale);
      const step = (crop.maxScale - crop.minScale) / 200;
      cropZoom.step = String(step > 0 ? step : 0.01);
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
      cropFrame?.style?.setProperty('--crop-ratio', '1920 / 1080');
      cropFrame.style.aspectRatio = '1920 / 1080';
    } catch {}

    try { if (cropSrcUrl) URL.revokeObjectURL(cropSrcUrl); } catch {}
    cropSrcUrl = URL.createObjectURL(file);

    cropImg.onload = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          refreshCropConstraints();
          resetCrop();
        });
      });
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
    crop.startX = e.clientX;
    crop.startY = e.clientY;
    crop.pointerId = e.pointerId;
    try { cropFrame.setPointerCapture(e.pointerId); } catch {}
  });

  cropFrame?.addEventListener('pointermove', (e) => {
    if (!crop.dragging) return;
    if (crop.pointerId != null && e.pointerId !== crop.pointerId) return;
    crop.x += (e.clientX - crop.startX);
    crop.y += (e.clientY - crop.startY);
    crop.startX = e.clientX;
    crop.startY = e.clientY;
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
    const v = Number(cropZoom.value);
    crop.scale = clamp(v, crop.minScale, crop.maxScale);
    updateZoomTrack();
    updateCropTransform();
  });

  cropReset?.addEventListener('click', () => {
    refreshCropConstraints();
    resetCrop();
  });

  // ---------- Export ----------
  function normalizeZipName(name){
    let out = (name || '').toString().trim();
    out = out.replace(/\.{2,}zip$/i, '.zip');
    if (!/\.zip$/i.test(out)) out += '.zip';
    return out;
  }

  async function loadFixedWatermarkLogo(){
    const url = './assets/logo-watermark.png';
    try {
      const res = await fetch(url, { cache:'no-store' });
      if (res.ok) return await createImageBitmap(await res.blob(), { imageOrientation:'from-image' });
    } catch {}
    try {
      const res = await fetch('./assets/logo.png', { cache:'no-store' });
      if (res.ok) return await createImageBitmap(await res.blob(), { imageOrientation:'from-image' });
    } catch {}
    return null;
  }

  async function loadComingsoonOverlays(){
    const base = './assets/comingsoon/';
    const out = { velina:null, testo:null };
    try {
      const r1 = await fetch(base + 'velina.png', { cache:'no-store' });
      if (r1.ok) out.velina = await createImageBitmap(await r1.blob(), { imageOrientation:'from-image' });
    } catch {}
    try {
      const r2 = await fetch(base + 'testo.png', { cache:'no-store' });
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
      const cx = (W/2) + dxOut;
      const cy = (H/2) + dyOut;
      const x = cx - (dw/2);
      const y = cy - (dh/2);
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
    const x = Math.round((W - lw)/2);
    const y = Math.round((H - lh)/2);
    ctx.drawImage(logoBmp, x, y, lw, lh);
  }

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
      const bmp = await loadImageBitmap(rec.file);
      const c = drawCoverToCanvas(bmp, 1024, 768);
      drawLogoCenter(c, logo);
      const jpg = await canvasToBlob(c, 'image/jpeg', 0.92);
      const nn = String(++counterImg).padStart(2,'0');
      zip.file(`_EXPORT_WATERMARK/immagini/immagini-${nn}.jpg`, jpg);
      ActionProgress.value = Math.round((++done/total)*100);
    }

    if (pdfs.length){
      await ensurePdfJs();
      for (const rec of pdfs){
        const ab = await rec.file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({data:ab}).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 300/72 });
        const tmp = document.createElement('canvas');
        tmp.width = Math.ceil(viewport.width);
        tmp.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: tmp.getContext('2d'), viewport }).promise;
        const bmp = await createImageBitmap(tmp);

        const c = document.createElement('canvas');
        c.width = 1024; c.height = 768;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,1024,768);
        const s = Math.min(1024/bmp.width, 768/bmp.height);
        const dw = Math.round(bmp.width*s);
        const dh = Math.round(bmp.height*s);
        const dx = Math.round((1024-dw)/2);
        const dy = Math.round((768-dh)/2);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bmp, dx, dy, dw, dh);

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
    a.download = normalizeZipName(`EXPORT_WATERMARK-${Date.now()}.zip`);
    a.click();
    URL.revokeObjectURL(a.href);
    hideEl(ActionProgressWrap);
  }

  async function exportComingsoon(){
    const images = (wmPicked || []).filter(r => /\.(jpe?g|png|tif?f|webp)$/i.test(r.file.name));
    if (!images.length){
      alert('Carica la cartella/singola immagine nella sezione Coming soon.');
      return;
    }

    const overlays = await loadComingsoonOverlays();
    if (!overlays.velina || !overlays.testo){
      alert('Mancano overlay Coming soon. Carica in assets/comingsoon/ velina.png e testo.png (1920×1080).');
      return;
    }

    const zip = new JSZip();

    showEl(ActionProgressWrap);
    ActionProgress.value = 0;
    ActionProgressLabel.textContent = 'Elaborazione…';

    const total = images.length;
    let done = 0;
    let counter = 0;

    for (const rec of images){
      const bmp = await loadImageBitmap(rec.file);
      const W = 1920, H = 1080;

      const useCrop = (total === 1 && cropWrap && !cropWrap.classList.contains('hidden'));
      const baseCanvas = useCrop ? drawCroppedToCanvas(bmp, W, H) : drawCoverToCanvas(bmp, W, H);

      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.filter = 'blur(5px)';
      ctx.drawImage(baseCanvas, 0, 0, W, H);
      ctx.filter = 'none';

      ctx.drawImage(overlays.velina, 0, 0, W, H);
      ctx.drawImage(overlays.testo, 0, 0, W, H);

      const outJpg = await canvasToBlob(c,'image/jpeg',0.92);
      const nn = String(++counter).padStart(2,'0');
      zip.file(`_EXPORT_COMINGSOON/comingsoon-${nn}.jpg`, outJpg);

      ActionProgress.value = Math.round((++done/total)*100);
    }

    const blob = await zip.generateAsync({type:'blob'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = normalizeZipName(`EXPORT_COMINGSOON-${Date.now()}.zip`);
    a.click();
    URL.revokeObjectURL(a.href);
    hideEl(ActionProgressWrap);
  }

  // Entry point usato dal tool
  window.exportWatermarkPortali = async function(){
    const p = wmPreset || 'portali';
    if (p === 'comingsoon') return exportComingsoon();
    return exportPortali();
  };

})();
