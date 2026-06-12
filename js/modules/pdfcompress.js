/* ============================== Compressione PDF ============================== */
(function(){
  'use strict';

  const UploadTitle = document.getElementById('ImagesUploadTitle');
  const UploadHint = document.getElementById('ImagesUploadHint');
  const TxtFolderPath = document.getElementById('TxtFolderPath');
  const PdfCompressCard = document.getElementById('PdfCompressCard');
  const PdfCompressCount = document.getElementById('PdfCompressCount');

  const SHOW = (el) => el && el.classList.remove('hidden');
  const HIDE = (el) => el && el.classList.add('hidden');
  const actWrap = () => document.getElementById('ActionProgressWrap');
  const actBar = () => document.getElementById('ActionProgress');
  const actLabel = () => document.getElementById('ActionProgressLabel');

  function onlyPdfRecords(){
    return Array.isArray(window.picked)
      ? window.picked.filter(p => p?.file && /\.pdf$/i.test(p.file.name || ''))
      : [];
  }

  function normalizeZipPath(v){
    const p = String(v || '').replace(/\\/g, '/').replace(/^\/+/, '');
    return p || 'file.pdf';
  }

  function makeStamp(){
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  async function ensurePdfJsForCompress(){
    if (window.pdfjsLib) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  async function canvasToBlobLocal(canvas, type='image/jpeg', quality=0.88){
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Impossibile generare il file.')), type, quality);
    });
  }

  async function downscaleCanvas(sourceCanvas, scale){
    const dst = document.createElement('canvas');
    dst.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    dst.height = Math.max(1, Math.round(sourceCanvas.height * scale));
    const dctx = dst.getContext('2d', { alpha: false, willReadFrequently: false });
    dctx.imageSmoothingEnabled = true;
    dctx.imageSmoothingQuality = 'high';
    dctx.drawImage(sourceCanvas, 0, 0, dst.width, dst.height);
    return dst;
  }

  function computeSafeScale(page, desiredScale, maxPixels){
    const probe = page.getViewport({ scale: 1 });
    const desiredPixels = probe.width * probe.height * desiredScale * desiredScale;
    if (desiredPixels <= maxPixels) return desiredScale;
    const ratio = Math.sqrt(maxPixels / (probe.width * probe.height));
    return Math.max(1, desiredScale * ratio);
  }

  async function tryStructuralPdfOptimization(arrayBuffer){
    if (!window.PDFLib?.PDFDocument) {
      throw new Error('Libreria PDF non disponibile.');
    }
    const src = new Uint8Array(arrayBuffer.slice(0));
    const doc = await window.PDFLib.PDFDocument.load(src, {
      ignoreEncryption: true,
      updateMetadata: false,
      parseSpeed: window.PDFLib.ParseSpeeds?.Fastest
    });
    const bytes = await doc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      updateFieldAppearances: false,
      objectsPerTick: 40
    });
    return new Blob([bytes], { type: 'application/pdf' });
  }

  async function detectImageHeavyPdf(arrayBuffer){
    await ensurePdfJsForCompress();
    const loadingTask = window.pdfjsLib.getDocument({
      data: arrayBuffer.slice(0),
      useWorkerFetch: true,
      isEvalSupported: false,
      disableFontFace: false,
      verbosity: 0
    });
    const pdf = await loadingTask.promise;
    try {
      const samplePages = Math.min(pdf.numPages, 3);
      let textItems = 0;
      for (let pageNum = 1; pageNum <= samplePages; pageNum++){
        const page = await pdf.getPage(pageNum);
        try {
          const textContent = await page.getTextContent();
          textItems += Array.isArray(textContent?.items) ? textContent.items.length : 0;
        } finally {
          try { page.cleanup && page.cleanup(); } catch(_) {}
        }
      }
      return (textItems / Math.max(samplePages, 1)) < 18;
    } finally {
      try { pdf.cleanup && pdf.cleanup(); } catch(_) {}
      try { pdf.destroy && pdf.destroy(); } catch(_) {}
    }
  }

  async function fitScannedPage(canvas, targetQuality){
    const qualities = [targetQuality, Math.max(0.84, targetQuality - 0.03), Math.max(0.80, targetQuality - 0.06)];
    let best = null;
    let workCanvas = canvas;

    for (let round = 0; round < 3; round++){
      for (const q of qualities){
        const blob = await canvasToBlobLocal(workCanvas, 'image/jpeg', q);
        if (!best || blob.size < best.blob.size) best = { blob, canvas: workCanvas };
      }
      if (round < 2){
        const scaled = await downscaleCanvas(workCanvas, round === 0 ? 0.94 : 0.90);
        if (workCanvas !== canvas){
          workCanvas.width = 1;
          workCanvas.height = 1;
          workCanvas.remove();
        }
        workCanvas = scaled;
      }
    }

    return best;
  }

  async function buildRasterizedPdfBlob(arrayBuffer, fileName, onStatus){
    await ensurePdfJsForCompress();
    if (!window.PDFLib?.PDFDocument) {
      throw new Error('Libreria PDF non disponibile. Ricarica la pagina e riprova.');
    }

    const MAX_PAGE_PIXELS = 16000000;
    const loadingTask = window.pdfjsLib.getDocument({
      data: arrayBuffer.slice(0),
      useWorkerFetch: true,
      isEvalSupported: false,
      disableFontFace: false,
      verbosity: 0
    });
    const pdf = await loadingTask.promise;
    let smallestBlob = null;

    try {
      const attemptProfiles = [
        { renderScale: 2.05, jpegQuality: 0.92 },
        { renderScale: 1.85, jpegQuality: 0.90 }
      ];

      for (let i = 0; i < attemptProfiles.length; i++){
        const attempt = attemptProfiles[i];
        const outPdf = await window.PDFLib.PDFDocument.create();

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++){
          onStatus?.(`Compressione ${fileName} · pagina ${pageNum}/${pdf.numPages}…`);
          const page = await pdf.getPage(pageNum);
          let canvas = null;
          try {
            const pageViewport = page.getViewport({ scale: 1 });
            const renderScale = computeSafeScale(page, attempt.renderScale, MAX_PAGE_PIXELS);
            const viewport = page.getViewport({ scale: renderScale });
            canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.ceil(viewport.width));
            canvas.height = Math.max(1, Math.ceil(viewport.height));

            const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            await page.render({ canvasContext: ctx, viewport }).promise;

            const fitted = await fitScannedPage(canvas, attempt.jpegQuality);
            const jpgBytes = new Uint8Array(await fitted.blob.arrayBuffer());
            const embedded = await outPdf.embedJpg(jpgBytes);
            const outPage = outPdf.addPage([pageViewport.width, pageViewport.height]);
            outPage.drawImage(embedded, { x: 0, y: 0, width: pageViewport.width, height: pageViewport.height });

            if (fitted.canvas !== canvas){
              canvas.width = 1;
              canvas.height = 1;
              canvas.remove();
              canvas = fitted.canvas;
            }
          } finally {
            try { page.cleanup && page.cleanup(); } catch(_) {}
            if (canvas){
              canvas.width = 1;
              canvas.height = 1;
              canvas.remove();
            }
          }
        }

        const bytes = await outPdf.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 40 });
        const blob = new Blob([bytes], { type: 'application/pdf' });
        if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
      }
    } finally {
      try { pdf.cleanup && pdf.cleanup(); } catch(_) {}
      try { pdf.destroy && pdf.destroy(); } catch(_) {}
    }

    return smallestBlob;
  }

  async function buildCompressedPdfBlob(file, onStatus){
    const originalBuffer = await file.arrayBuffer();

    let structuralBlob = null;
    try {
      structuralBlob = await tryStructuralPdfOptimization(originalBuffer);
    } catch (err){
      console.warn('[PDFCOMPRESS] Structural optimization skipped:', err);
    }

    const originalSize = file.size || 0;
    const structuralSize = structuralBlob?.size || Number.POSITIVE_INFINITY;
    const structuralGain = structuralBlob ? (1 - (structuralSize / Math.max(originalSize, 1))) : 0;

    if (structuralBlob && structuralGain >= 0.02) {
      return { blob: structuralBlob, changed: true, strategy: 'structural' };
    }

    let imageHeavy = false;
    try {
      imageHeavy = await detectImageHeavyPdf(originalBuffer);
    } catch (err){
      console.warn('[PDFCOMPRESS] Image-heavy detection skipped:', err);
    }

    if (!imageHeavy){
      if (structuralBlob && structuralBlob.size < originalSize * 0.995) {
        return { blob: structuralBlob, changed: true, strategy: 'structural' };
      }
      return { blob: file, changed: false, strategy: 'original' };
    }

    let rasterBlob = null;
    try {
      rasterBlob = await buildRasterizedPdfBlob(originalBuffer, file.name, onStatus);
    } catch (err){
      console.warn('[PDFCOMPRESS] Raster fallback skipped:', err);
    }

    const candidates = [
      { blob: file, size: originalSize, strategy: 'original' },
      structuralBlob ? { blob: structuralBlob, size: structuralBlob.size, strategy: 'structural' } : null,
      rasterBlob ? { blob: rasterBlob, size: rasterBlob.size, strategy: 'raster' } : null
    ].filter(Boolean);

    candidates.sort((a, b) => a.size - b.size);
    const best = candidates[0] || { blob: file, size: originalSize, strategy: 'original' };

    if (best.strategy === 'raster'){
      const shouldUseRaster = best.size <= (originalSize * 0.92) && (!structuralBlob || best.size <= structuralBlob.size * 0.97);
      if (!shouldUseRaster){
        if (structuralBlob && structuralBlob.size < originalSize * 0.995) {
          return { blob: structuralBlob, changed: true, strategy: 'structural' };
        }
        return { blob: file, changed: false, strategy: 'original' };
      }
    }

    if (best.strategy === 'original') {
      return { blob: file, changed: false, strategy: 'original' };
    }
    return { blob: best.blob, changed: true, strategy: best.strategy };
  }

  function updateUploadCopyForPdfMode(){
    const mode = String(window.currentMode || '').toLowerCase();
    if (!UploadTitle || !UploadHint || !TxtFolderPath) return;

    if (mode === 'pdfcompress') {
      UploadTitle.textContent = 'Carica PDF*';
      UploadHint.textContent = 'Drag & drop o selezione multipla. Puoi caricare un singolo file, più PDF o una cartella trascinata. Il tool mantiene nomi e struttura originali nello ZIP finale.';
      SHOW(UploadHint);
      if (!(Array.isArray(window.picked) && window.picked.length)) {
        TxtFolderPath.textContent = 'Trascina qui uno o più PDF o clicca per sfogliare…';
      }
      return;
    }

    if (mode !== 'images') {
      UploadTitle.textContent = 'Carica cartella*';
      UploadHint.textContent = '';
      HIDE(UploadHint);
      if (!(Array.isArray(window.picked) && window.picked.length)) {
        TxtFolderPath.textContent = 'Trascina qui la cartella o clicca per sfogliare…';
      }
    }
  }

  function refreshPdfCompressUI(){
    updateUploadCopyForPdfMode();
    if (!PdfCompressCard) return;

    const mode = String(window.currentMode || '').toLowerCase();
    if (mode !== 'pdfcompress') {
      HIDE(PdfCompressCard);
      return;
    }

    SHOW(PdfCompressCard);
    if (PdfCompressCount) PdfCompressCount.textContent = String(onlyPdfRecords().length || 0);
  }

  async function triggerZipDownload(zip, filename){
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } }, (meta) => {
      const label = actLabel();
      if (label) label.textContent = `Compressione ZIP… ${Math.round(meta.percent || 0)}%`;
    });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function exportPdfCompress(){
    const records = onlyPdfRecords();
    if (!records.length){
      alert('Carica almeno un PDF.');
      return;
    }

    const wrap = actWrap();
    const bar = actBar();
    const label = actLabel();
    SHOW(wrap);
    if (bar) bar.value = 0;
    if (label) label.textContent = 'Preparazione compressione PDF…';

    const zip = new JSZip();
    let processed = 0;

    try {
      for (const rec of records){
        const path = normalizeZipPath(rec?.relPath || rec?.file?.webkitRelativePath || rec?.file?.name || 'file.pdf');
        const result = await buildCompressedPdfBlob(rec.file, (txt) => {
          if (label) label.textContent = txt;
        });
        zip.file(path, result.blob || rec.file, { binary: true });
        processed += 1;
        if (bar) bar.value = Math.round((processed / Math.max(records.length, 1)) * 100);
        if (label) label.textContent = `Compressione PDF… ${processed}/${records.length}`;
      }

      await triggerZipDownload(zip, `PDF_COMPRESS-${makeStamp()}.zip`);
      if (bar) bar.value = 100;
      if (label) label.textContent = 'Compressione completata.';
      setTimeout(() => HIDE(wrap), 1200);
    } catch (err){
      console.error('[PDFCOMPRESS] Compression error:', err);
      HIDE(wrap);
      alert('Si è verificato un problema durante la compressione PDF. Riprova con file più piccoli o riduci il numero di PDF caricati.');
      throw err;
    }
  }

  document.getElementById('BtnClearPath')?.addEventListener('click', () => setTimeout(refreshPdfCompressUI, 0));
  try { refreshPdfCompressUI(); } catch {}
  window.refreshPdfCompressUI = refreshPdfCompressUI;
  window.exportPdfCompress = exportPdfCompress;
})();