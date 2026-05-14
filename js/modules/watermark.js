/* ========================= WATERMARK (presets) ========================= */
// Preset 1: Portali immobiliari
//  - Usa SOLO assets/logo-watermark.png (nessun logo opzionale)
//  - Stessa logica attuale (immagini + PDF)
// Preset 2: Coming soon sito
//  - Immagini -> 1920x1080 (cover)
//  - Sfocatura (blur) raggio 5px
//  - Overlay di 2 PNG (velina + testo) 1920x1080
//  - Output in ZIP
// Nota: questo modulo NON tocca altri moduli.

(function(){
  'use strict';

  // Preset UI (dentro WatermarkCard)
  const pills = document.getElementById('WmPresetPills');
  const infoPortali = document.getElementById('WmPortaliInfo');
  const infoComing = document.getElementById('WmComingsoonInfo');

  let wmPreset = 'portali';

  function setPreset(p){
    wmPreset = p;
    // UI toggle
    if (infoPortali && infoComing){
      if (p === 'comingsoon'){
        infoPortali.classList.add('hidden');
        infoComing.classList.remove('hidden');
      } else {
        infoComing.classList.add('hidden');
        infoPortali.classList.remove('hidden');
      }
    }
    // attiva pill
    if (pills){
      pills.querySelectorAll('[data-wm-preset]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-wm-preset') === p);
      });
    }
  }

  if (pills){
    pills.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('[data-wm-preset]') : null;
      if (!btn) return;
      setPreset(btn.getAttribute('data-wm-preset'));
    });
    // default
    setPreset('portali');
  }

  async function loadFixedWatermarkLogo(){
    const url = './assets/logo-watermark.png';
    try {
      const res = await fetch(url, { cache:'no-store' });
      if (res.ok) return await createImageBitmap(await res.blob(), { imageOrientation:'from-image' });
    } catch {}
    // fallback
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

    // IMMAGINI -> cover 1024x768 (come logica attuale)
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

    // PDF (A3) -> render pagina 1 -> contain su 1024x768, logo al centro
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

        // contain
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
    const images = (window.picked || []).filter(p => /\.(jpe?g|png|tif?f|webp)$/i.test(p.file.name));
    if (!images.length){ alert('Carica una cartella con immagini.'); return; }

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

      // 1920x1080 cover
      const c = document.createElement('canvas');
      c.width = 1920; c.height = 1080;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const s = Math.max(1920/bmp.width, 1080/bmp.height);
      const dw = Math.round(bmp.width*s);
      const dh = Math.round(bmp.height*s);
      const dx = Math.round((1920-dw)/2);
      const dy = Math.round((1080-dh)/2);

      // blur background
      ctx.filter = 'blur(5px)';
      ctx.drawImage(bmp, dx, dy, dw, dh);
      ctx.filter = 'none';

      // overlay 1: velina
      ctx.drawImage(overlays.velina, 0, 0, 1920, 1080);
      // overlay 2: testo
      ctx.drawImage(overlays.testo, 0, 0, 1920, 1080);

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

  // Manteniamo lo stesso nome funzione atteso dal tool.
  window.exportWatermarkPortali = async function(){
    // se il preset UI non è presente (compatibilità), default portali
    const p = wmPreset || 'portali';
    if (p === 'comingsoon') return exportComingsoon();
    return exportPortali();
  };

})();
