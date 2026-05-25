/* ============================== PDF → JPG ============================= */
async function ensurePdfJs(){
  if (window.pdfjsLib) return;
  await new Promise((resolve,reject)=>{
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

function sleep(ms=0){
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeZipName(name){
  let out = String(name || 'EXPORT_PDF2JPG').trim();
  out = out.replace(/[\\/:*?"<>|]+/g, '-');
  out = out.replace(/\s+/g, '-');
  out = out.replace(/-{2,}/g, '-');
  out = out.replace(/^[-.]+|[-.]+$/g, '');
  return out || 'EXPORT_PDF2JPG';
}

async function triggerZipDownload(zip, filename){
  const blob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 4 }
    },
    (meta)=>{
      if (ActionProgressLabel) {
        ActionProgressLabel.textContent = `Compressione ZIP… ${Math.round(meta.percent || 0)}%`;
      }
    }
  );

  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  await sleep(80);
}

function computeSafeScale(page, desiredScale, maxPixels){
  const probe = page.getViewport({ scale: 1 });
  const desiredPixels = probe.width * probe.height * desiredScale * desiredScale;
  if (desiredPixels <= maxPixels) return desiredScale;
  const ratio = Math.sqrt(maxPixels / (probe.width * probe.height));
  return Math.max(1, desiredScale * ratio);
}

async function canvasToJpegBlob(canvas, quality){
  return await canvasToBlob(canvas, 'image/jpeg', quality);
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

async function fitJpegUnderTarget(canvas, targetBytes){
  const qualities = [0.9, 0.84, 0.78, 0.72, 0.66, 0.60, 0.54];
  let bestBlob = null;

  for (const q of qualities){
    const blob = await canvasToJpegBlob(canvas, q);
    bestBlob = blob;
    if (blob.size <= targetBytes) return { blob, canvas };
  }

  let workCanvas = canvas;
  for (let i = 0; i < 3; i++){
    const ratio = Math.min(0.86, Math.max(0.55, Math.sqrt(targetBytes / Math.max(bestBlob.size, 1)) * 0.96));
    const scaled = await downscaleCanvas(workCanvas, ratio);
    if (workCanvas !== canvas){
      workCanvas.width = 1;
      workCanvas.height = 1;
      workCanvas.remove();
    }
    workCanvas = scaled;

    for (const q of qualities){
      const blob = await canvasToJpegBlob(workCanvas, q);
      bestBlob = blob;
      if (blob.size <= targetBytes) return { blob, canvas: workCanvas };
    }
  }

  return { blob: bestBlob, canvas: workCanvas };
}

async function exportPdfToJpg(){
  const pdfs = (picked || []).filter(p => /\.pdf$/i.test(p.file?.name || ''));
  if (!pdfs.length){
    alert('Carica almeno un PDF.');
    return;
  }

  await ensurePdfJs();

  const TARGET_JPG_BYTES = 1.5 * 1024 * 1024;
  const MAX_PAGE_PIXELS = 12_000_000;
  const PREFERRED_DPI = 220;
  const ZIP_SOFT_LIMIT = 120 * 1024 * 1024;
  const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
  const baseZipName = sanitizeZipName(`EXPORT_PDF2JPG-${stamp}`);

  let zipPart = 1;
  let zip = new JSZip();
  let zipBytes = 0;
  let zipEntries = 0;
  let convertedPages = 0;
  let totalPdfProcessed = 0;

  showEl(ActionProgressWrap);
  ActionProgress.value = 0;
  ActionProgressLabel.textContent = 'Preparazione esportazione…';

  async function flushCurrentZip(forceLabel){
    if (!zipEntries) return;
    const partName = `${baseZipName}-part${String(zipPart).padStart(2,'0')}.zip`;
    if (ActionProgressLabel) {
      ActionProgressLabel.textContent = forceLabel || `Creo archivio ${zipPart}…`;
    }
    await triggerZipDownload(zip, partName);
    zipPart += 1;
    zip = new JSZip();
    zipBytes = 0;
    zipEntries = 0;
    await sleep(50);
  }

  try {
    for (const rec of pdfs){
      const file = rec.file;
      const relPath = rec.relPath || file.name;
      const relFolder = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '';
      const baseName = file.name.replace(/\.pdf$/i, '');
      const prefixDir = `_EXPORT_PDF2JPG/${relFolder ? relFolder + '/' : ''}`;

      if (ActionProgressLabel) {
        ActionProgressLabel.textContent = `Apro ${file.name}…`;
      }

      const ab = await file.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({
        data: ab,
        useWorkerFetch: true,
        isEvalSupported: false,
        disableFontFace: false,
        verbosity: 0
      });
      const pdf = await loadingTask.promise;

      try {
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++){
          if (ActionProgressLabel) {
            ActionProgressLabel.textContent = `Converto ${file.name} · pagina ${pageNum}/${pdf.numPages}…`;
          }

          const page = await pdf.getPage(pageNum);
          let canvas = null;

          try {
            const desiredScale = PREFERRED_DPI / 72;
            const safeScale = computeSafeScale(page, desiredScale, MAX_PAGE_PIXELS);
            const viewport = page.getViewport({ scale: safeScale });

            canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.ceil(viewport.width));
            canvas.height = Math.max(1, Math.ceil(viewport.height));

            const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            await page.render({ canvasContext: ctx, viewport }).promise;
            let fit = await fitJpegUnderTarget(canvas, TARGET_JPG_BYTES);
            let blob = fit.blob;

            if (fit.canvas !== canvas){
              canvas.width = 1;
              canvas.height = 1;
              canvas.remove();
              canvas = fit.canvas;
            }

            if (zipEntries > 0 && (zipBytes + blob.size) > ZIP_SOFT_LIMIT){
              await flushCurrentZip(`Archivio ${zipPart} pronto, preparo il successivo…`);
            }

            const suffix = pdf.numPages > 1 ? `-${String(pageNum).padStart(2,'0')}` : '';
            zip.file(`${prefixDir}${baseName}${suffix}.jpg`, blob, { binary: true });
            zipBytes += blob.size;
            zipEntries += 1;
            convertedPages += 1;
          } finally {
            try { page.cleanup && page.cleanup(); } catch(_){}
            if (canvas){
              canvas.width = 1;
              canvas.height = 1;
              canvas.remove();
            }
          }

          if (convertedPages % 2 === 0) await sleep(0);
        }
      } finally {
        try { pdf.cleanup && pdf.cleanup(); } catch(_){}
        try { pdf.destroy && pdf.destroy(); } catch(_){}
      }

      totalPdfProcessed += 1;
      ActionProgress.value = Math.round((totalPdfProcessed / pdfs.length) * 100);
      await sleep(0);
    }

    await flushCurrentZip('Creo ZIP finale…');
    ActionProgress.value = 100;
    ActionProgressLabel.textContent = zipPart > 2
      ? `Esportazione completata: ${zipPart - 1} archivi ZIP creati.`
      : 'Esportazione completata.';

    setTimeout(() => hideEl(ActionProgressWrap), 1200);
  } catch (err){
    console.error('[PDF2JPG] Export error:', err);
    hideEl(ActionProgressWrap);
    alert('Si è verificato un problema durante l\'esportazione PDF → JPG. Riprova con un set più piccolo oppure verifica i PDF caricati.');
    throw err;
  }
}
