/* ============================== Compressione PDF ============================== */
(function(){
  'use strict';

  const UploadTitle = document.getElementById('ImagesUploadTitle');
  const UploadHint = document.getElementById('ImagesUploadHint');
  const TxtFolderPath = document.getElementById('TxtFolderPath');
  const PdfCompressCard = document.getElementById('PdfCompressCard');
  const PdfCompressCount = document.getElementById('PdfCompressCount');
  const PdfCompressQuality = document.getElementById('PdfCompressQuality');
  const PdfCompressQualityValue = document.getElementById('PdfCompressQualityValue');
  const PdfCompressQualityNote = document.getElementById('PdfCompressQualityNote');
  const PdfCompressMaxMb = document.getElementById('PdfCompressMaxMb');

  const SHOW = (el) => el && el.classList.remove('hidden');
  const HIDE = (el) => el && el.classList.add('hidden');
  const actWrap = () => document.getElementById('ActionProgressWrap');
  const actBar = () => document.getElementById('ActionProgress');
  const actLabel = () => document.getElementById('ActionProgressLabel');

  const PDF_PRESETS = [
    {
      label: 'Alta qualità',
      note: 'Compressione leggera: resa migliore per documenti da inviare con leggibilità alta.',
      renderScale: 2.2,
      jpegQuality: 0.90,
      targetPageFloor: 420 * 1024
    },
    {
      label: 'Bilanciata',
      note: 'Preset consigliato: riduce il peso mantenendo una resa adatta alla maggior parte degli invii email.',
      renderScale: 1.85,
      jpegQuality: 0.82,
      targetPageFloor: 280 * 1024
    },
    {
      label: 'Forte compressione',
      note: 'Massimizza la riduzione del peso: ideale per allegati molto pesanti o limiti email restrittivi.',
      renderScale: 1.45,
      jpegQuality: 0.72,
      targetPageFloor: 180 * 1024
    }
  ];

  function onlyPdfRecords(){
    return Array.isArray(window.picked)
      ? window.picked.filter(p => p?.file && /\.pdf$/i.test(p.file.name || ''))
      : [];
  }

  function paintRangeFill(slider, pct){
    if (!slider) return;
    const safe = Math.max(0, Math.min(100, Number(pct) || 0));
    slider.style.setProperty('--fill', safe + '%');
    const gradient = `linear-gradient(to right, var(--red) 0 ${safe}%, var(--gray-200) ${safe}% 100%)`;
    slider.style.background = gradient;
    slider.style.backgroundImage = gradient;
  }

  function getPdfPreset(){
    const idx = Math.max(0, Math.min(PDF_PRESETS.length - 1, Number(PdfCompressQuality?.value) || 0));
    return PDF_PRESETS[idx];
  }

  function updatePdfPresetUI(){
    if (!PdfCompressQuality) return;
    const idx = Math.max(0, Math.min(PDF_PRESETS.length - 1, Number(PdfCompressQuality.value) || 0));
    const preset = PDF_PRESETS[idx];
    const pct = (idx / Math.max(PDF_PRESETS.length - 1, 1)) * 100;
    paintRangeFill(PdfCompressQuality, pct);
    if (PdfCompressQualityValue) PdfCompressQualityValue.textContent = preset.label;
    if (PdfCompressQualityNote) PdfCompressQualityNote.textContent = preset.note;
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

  function computeSafeScale(page, desiredScale, maxPixels){
    const probe = page.getViewport({ scale: 1 });
    const desiredPixels = probe.width * probe.height * desiredScale * desiredScale;
    if (desiredPixels <= maxPixels) return desiredScale;
    const ratio = Math.sqrt(maxPixels / (probe.width * probe.height));
    return Math.max(1, desiredScale * ratio);
  }

  function canvasToBlobLocal(canvas, type='image/jpeg', quality=0.85){
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

  async function fitJpegUnderTarget(canvas, startQuality, targetBytes){
    const qualities = [
      startQuality,
      Math.max(0.68, startQuality - 0.06),
      Math.max(0.58, startQuality - 0.12),
      Math.max(0.50, startQuality - 0.18)
    ];
    let bestBlob = null;
    let workCanvas = canvas;
    for (let round = 0; round < 4; round++){
      for (const q of qualities){
        const blob = await canvasToBlobLocal(workCanvas, 'image/jpeg', q);
        bestBlob = blob;
        if (!targetBytes || blob.size <= targetBytes) return { blob, canvas: workCanvas };
      }
      const ratio = round === 0 ? 0.92 : (round === 1 ? 0.86 : 0.78);
      const scaled = await downscaleCanvas(workCanvas, ratio);
      if (workCanvas !== canvas){
        workCanvas.width = 1;
        workCanvas.height = 1;
        workCanvas.remove();
      }
      workCanvas = scaled;
    }
    return { blob: bestBlob, canvas: workCanvas };
  }

  function buildAttemptProfiles(preset){
    return [
      { scale: preset.renderScale, q: preset.jpegQuality },
      { scale: Math.max(1.2, preset.renderScale * 0.92), q: Math.max(0.66, preset.jpegQuality - 0.06) },
      { scale: Math.max(1.08, preset.renderScale * 0.86), q: Math.max(0.58, preset.jpegQuality - 0.12) },
      { scale: Math.max(1.0, preset.renderScale * 0.76), q: Math.max(0.50, preset.jpegQuality - 0.18) }
    ];
  }

  async function buildCompressedPdfBlob(file, preset, maxBytes, onStatus){
    await ensurePdfJsForCompress();
    if (!window.PDFLib?.PDFDocument) {
      throw new Error('Libreria PDF non disponibile. Ricarica la pagina e riprova.');
    }
    if (maxBytes && file.size <= maxBytes) {
      return { blob: file, changed: false, hitTarget: true };
    }
    const MAX_PAGE_PIXELS = 12000000;
    const loadingTask = window.pdfjsLib.getDocument({
      data: await file.arrayBuffer(),
      useWorkerFetch: true,
      isEvalSupported: false,
      disableFontFace: false,
      verbosity: 0
    });
    const pdf = await loadingTask.promise;
    let smallestBlob = null;
    try {
      const attempts = maxBytes ? buildAttemptProfiles(preset) : [buildAttemptProfiles(preset)[0]];
      for (let attemptIndex = 0; attemptIndex < attempts.length; attemptIndex++){
        const attempt = attempts[attemptIndex];
        const outPdf = await window.PDFLib.PDFDocument.create();
        const perPageBudget = maxBytes
          ? Math.max(preset.targetPageFloor, Math.floor((maxBytes * 0.92) / Math.max(pdf.numPages, 1)))
          : null;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++){
          onStatus?.(`Compressione ${file.name} · pagina ${pageNum}/${pdf.numPages}…`);
          const page = await pdf.getPage(pageNum);
          let canvas = null;
          try {
            const pageViewport = page.getViewport({ scale: 1 });
            const renderScale = computeSafeScale(page, attempt.scale, MAX_PAGE_PIXELS);
            const viewport = page.getViewport({ scale: renderScale });
            canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.ceil(viewport.width));
            canvas.height = Math.max(1, Math.ceil(viewport.height));
            const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            await page.render({ canvasContext: ctx, viewport }).promise;
            const fitted = await fitJpegUnderTarget(canvas, attempt.q, perPageBudget);
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
        const bytes = await outPdf.save({ useObjectStreams: true, addDefaultPage: false });
        const blob = new Blob([bytes], { type: 'application/pdf' });
        if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
        if (!maxBytes || blob.size <= maxBytes) break;
      }
    } finally {
      try { pdf.cleanup && pdf.cleanup(); } catch(_) {}
      try { pdf.destroy && pdf.destroy(); } catch(_) {}
    }

    if (!smallestBlob) return { blob: file, changed: false, hitTarget: !maxBytes || file.size <= maxBytes };
    if (smallestBlob.size >= Math.round(file.size * 0.985)) {
      return { blob: file, changed: false, hitTarget: !maxBytes || file.size <= maxBytes };
    }
    return { blob: smallestBlob, changed: true, hitTarget: !maxBytes || smallestBlob.size <= maxBytes };
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
    updatePdfPresetUI();
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
    const preset = getPdfPreset();
    const maxMb = Number(PdfCompressMaxMb?.value);
    const maxBytes = maxMb > 0 ? Math.round(maxMb * 1024 * 1024) : null;
    const wrap = actWrap();
    const bar = actBar();
    const label = actLabel();
    SHOW(wrap);
    if (bar) bar.value = 0;
    if (label) label.textContent = 'Preparazione compressione PDF…';

    const zip = new JSZip();
    let processed = 0;
    let missedTarget = 0;

    try {
      for (const rec of records){
        const path = normalizeZipPath(rec?.relPath || rec?.file?.webkitRelativePath || rec?.file?.name || 'file.pdf');
        const result = await buildCompressedPdfBlob(rec.file, preset, maxBytes, (txt) => {
          if (label) label.textContent = txt;
        });
        if (maxBytes && !result.hitTarget) missedTarget += 1;
        zip.file(path, result.blob || rec.file, { binary: true });
        processed += 1;
        if (bar) bar.value = Math.round((processed / Math.max(records.length, 1)) * 100);
        if (label) label.textContent = `Compressione PDF… ${processed}/${records.length}`;
      }
      await triggerZipDownload(zip, `PDF_COMPRESS-${makeStamp()}.zip`);
      if (bar) bar.value = 100;
      if (label) label.textContent = 'Compressione completata.';
      setTimeout(() => HIDE(wrap), 1200);
      if (maxBytes && missedTarget > 0) {
        alert(`Compressione completata. ${missedTarget} PDF non sono scesi sotto il limite impostato senza ridurre ulteriormente la qualità.`);
      }
    } catch (err){
      console.error('[PDFCOMPRESS] Compression error:', err);
      HIDE(wrap);
      alert('Si è verificato un problema durante la compressione PDF. Riprova con file più piccoli o riduci il numero di PDF caricati.');
      throw err;
    }
  }

  PdfCompressQuality?.addEventListener('input', updatePdfPresetUI);
  PdfCompressQuality?.addEventListener('change', updatePdfPresetUI);
  document.getElementById('BtnClearPath')?.addEventListener('click', () => setTimeout(refreshPdfCompressUI, 0));

  try { updatePdfPresetUI(); } catch {}
  try { refreshPdfCompressUI(); } catch {}

  window.refreshPdfCompressUI = refreshPdfCompressUI;
  window.exportPdfCompress = exportPdfCompress;
})();
