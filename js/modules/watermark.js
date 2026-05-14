/* ========================= WATERMARK (presets) ========================= */
// Preset 1: Portali immobiliari
//  - Usa SOLO assets/logo-watermark.png (nessun logo opzionale)
//  - Stessa logica attuale (immagini + PDF)
// Preset 2: Coming soon sito
//  - Immagini -> 1920x1080 (cover)
//  - Sfocatura (blur) raggio 5px
//  - Overlay di 2 PNG (velina + testo) 1920x1080
//  - Supporta anche singola immagine (senza cartella) + crop manuale
// Nota: questo modulo NON tocca altri moduli.

(function(){
  'use strict';

  // Preset UI
  const pills = document.getElementById('WmPresetPills');
  const singleWrap = document.getElementById('WmSingleWrap');
  const assetsHint = document.getElementById('WmComingsoonAssetsHint');

  const singleDrop = document.getElementById('WmSingleDrop');
  const singleName = document.getElementById('WmSingleName');
  const singleClear = document.getElementById('WmSingleClear');

  const cropWrap = document.getElementById('WmCropWrap');
  const cropFrame = document.getElementById('WmCropFrame');
  const cropImg = document.getElementById('WmCropImg');
  const cropZoom = document.getElementById('WmCropZoom');
  const cropReset = document.getElementById('WmCropReset');

  let wmPreset = 'portali';
  let singleFile = null;
  let singleUrl = '';

  // Stato crop (pan + zoom) per Coming soon
  let crop = {
    x: 0, y: 0, scale: 1,
    minScale: 0.01, maxScale: 4,
    coverScale: 1, containScale: 1,
    dragging: false, startX: 0, startY: 0,
    pointerId: null
  };

  function clamp(v,a,b){ return Math.min(b, Math.max(a,v)); }

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

    const contain = Math.min(frameW / iw, frameH / ih);
    const cover = Math.max(frameW / iw, frameH / ih);

    crop.containScale = Math.max(0.01, contain);
    crop.coverScale = Math.max(crop.containScale, cover);
    crop.minScale = crop.containScale;
    crop.maxScale = Math.max(crop.coverScale * 3, crop.minScale * 3, crop.minScale + 0.01);

    if (cropZoom){
      cropZoom.min = String(crop.minScale);
      cropZoom.max = String(crop.maxScale);
      const step = (crop.maxScale - crop.minScale) / 200;
      cropZoom.step = String(step > 0 ? step : 0.01);
      crop.scale = clamp(crop.scale || crop.coverScale, crop.minScale, crop.maxScale);
      cropZoom.value = String(crop.scale);
      updateZoomTrack();
    }
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

    // imposta ratio 16:9 se supportato dal css
    try {
      cropFrame?.style?.setProperty('--crop-ratio', '1920 / 1080');
      cropFrame.style.aspectRatio = '1920 / 1080';
    } catch {}

    try {
      if (singleUrl) URL.revokeObjectURL(singleUrl);
    } catch {}
    singleUrl = URL.createObjectURL(file);

    cropImg.onload = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try { refreshCropConstraints(); } catch {}
          try { resetCrop(); } catch {}
        });
      });
    };
    cropImg.src = singleUrl;
  }

  function hideCropUI(){
    cropWrap?.classList.add('hidden');
    try { if (singleUrl) URL.revokeObjectURL(singleUrl); } catch {}
    singleUrl = '';
  }

  function setPreset(p){
    wmPreset = p || 'portali';

    // attiva pill
    if (pills){
      pills.querySelectorAll('[data-wm-preset]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-wm-preset') === wmPreset);
      });
    }

    // Comingsoon UI
    if (singleWrap && assetsHint){
      const on = (wmPreset === 'comingsoon');
      singleWrap.classList.toggle('hidden', !on);
      assetsHint.classList.toggle('hidden', !on);
      if (!on){
        // reset stato
        singleFile = null;
        if (singleName) singleName.textContent = "Trascina qui un'immagine o clicca per sfogliare…";
        singleClear?.classList.add('hidden');
        hideCropUI();
      }
    }
  }

  if (pills){
    pills.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('[data-wm-preset]') : null;
      if (!btn) return;
      setPreset(btn.getAttribute('data-wm-preset'));
    });
    setPreset('portali');
  }

  // Single image input (Coming soon)
  function setSingleFile(f){
    singleFile = f;
    if (singleName) singleName.textContent = f ? f.name : "Trascina qui un'immagine o clicca per sfogliare…";
    if (singleClear){
      singleClear.classList.toggle('hidden', !f);
    }
    if (f) showCropUI(f);
    else hideCropUI();
  }

  if (singleDrop){
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ['dragenter','dragover','dragleave','drop'].forEach(ev => singleDrop.addEventListener(ev, stop));
    singleDrop.addEventListener('dragenter', () => singleDrop.classList.add('drag-over'));
    singleDrop.addEventListener('dragleave', () => singleDrop.classList.remove('drag-over'));
    singleDrop.addEventListener('drop', (e) => {
      singleDrop.classList.remove('drag-over');
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      if (!f.type || !f.type.startsWith('image/')){ alert('Carica un file immagine.'); return; }
      setSingleFile(f);
    });
    singleDrop.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = () => {
        const f = inp.files?.[0];
        if (!f) return;
        setSingleFile(f);
      };
      inp.click();
    });
  }
  singleClear?.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    setSingleFile(null);
  });

  // Crop events
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
    try { refreshCropConstraints(); } catch {}
    resetCrop();
  });

  // Se l'utente carica una cartella con 1 immagine in Coming soon, abilita crop anche lì.
  let lastSig = '';
  function pollPicked(){
    if (wmPreset !== 'comingsoon') return;
    if (singleFile) return; // se c'è single file, usiamo quello

    const imgs = (window.picked || []).filter(p => /\.(jpe?g|png|tif?f|webp)$/i.test(p.file.name));
    const sig = imgs.map(x => x.file.name).join('|');
    if (sig === lastSig) return;
    lastSig = sig;

    if (imgs.length === 1 && imgs[0]?.file && imgs[0].file.type?.startsWith('image/')){
      // mostra crop con questa immagine
      showCropUI(imgs[0].file);
    } else {
      hideCropUI();
    }
  }
  setInterval(pollPicked, 400);

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

  function normalizeZipName(name){
    let out = (name || '').toString().trim();
    out = out.replace(/\.{2,}zip$/i, '.zip');
    if (!/\.zip$/i.test(out)) out += '.zip';
    return out;
  }

  function drawCroppedToCanvas(bmp, W, H){
    // Replica concettuale del crop di Immagini: usa dimensioni del frame e stato crop
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

  async function exportPortali(){
    const images = (window.picked || []).filter(p => /\.(jpe?g|png|tif?f|webp)$/i.test(p.file.name));
    const pdfs = (window.picked || []).filter(p => /\.pdf$/i.test(p.file.name));
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
    // Se c'è singleFile, usiamo quello. Altrimenti usiamo le immagini della cartella.
    const pickedImages = (window.picked || []).filter(p => /\.(jpe?g|png|tif?f|webp)$/i.test(p.file.name));
    const images = singleFile ? [{ file: singleFile }] : pickedImages;

    if (!images.length){
      alert('Carica una cartella con immagini (in alto) oppure una singola immagine (qui sotto).');
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
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Se abbiamo 1 immagine e il crop è visibile, usiamo il crop manuale
      const useCrop = (total === 1 && cropWrap && !cropWrap.classList.contains('hidden'));
      const baseCanvas = useCrop ? drawCroppedToCanvas(bmp, W, H) : drawCoverToCanvas(bmp, W, H);

      // blur background
      ctx.filter = 'blur(5px)';
      ctx.drawImage(baseCanvas, 0, 0, W, H);
      ctx.filter = 'none';

      // overlay
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
