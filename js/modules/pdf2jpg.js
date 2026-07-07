/* ============================== PDF -> JPG ============================= */
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

function formatBytesPdf2Jpg(bytes){
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function setPdf2JpgProgress(done, total, label){
  if (ActionProgress){
    ActionProgress.max = 100;
    ActionProgress.value = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  }
  if (ActionProgressLabel){
    const pct = total > 0 ? ` ${Math.min(100, Math.round((done / total) * 100))}%` : '';
    ActionProgressLabel.textContent = label ? `${label}${pct}` : pct.trim();
  }
}

async function triggerZipDownload(zip, filename){
  const blob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'STORE',
      streamFiles: true
    },
    (meta)=>{
      if (ActionProgressLabel) {
        ActionProgressLabel.textContent = `Creo ZIP ${filename}... ${Math.round(meta.percent || 0)}%`;
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
  await sleep(120);
}

function computeSafeScale(page, desiredScale, maxPixels){
  const probe = page.getViewport({ scale: 1 });
  const nativePixels = Math.max(1, probe.width * probe.height);
  const desiredPixels = nativePixels * desiredScale * desiredScale;
  if (desiredPixels <= maxPixels) return desiredScale;
  return Math.max(1, Math.sqrt(maxPixels / nativePixels));
}

function getPdf2JpgProfile(totalPages){
  if (totalPages >= 40){
    return { dpi: 160, maxPixels: 7_000_000, targetBytes: 1.1 * 1024 * 1024 };
  }
  if (totalPages >= 15){
    return { dpi: 180, maxPixels: 9_000_000, targetBytes: 1.25 * 1024 * 1024 };
  }
  return { dpi: 220, maxPixels: 12_000_000, targetBytes: 1.5 * 1024 * 1024 };
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
  const qualities = [0.88, 0.80, 0.70, 0.60];
  let bestBlob = null;

  for (const q of qualities){
    const blob = await canvasToJpegBlob(canvas, q);
    bestBlob = blob;
    if (blob.size <= targetBytes) return { blob, canvas };
    await sleep(0);
  }

  let workCanvas = canvas;
  for (let i = 0; i < 3; i++){
    const ratio = Math.min(0.88, Math.max(0.58, Math.sqrt(targetBytes / Math.max(bestBlob.size, 1)) * 0.97));
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
      await sleep(0);
    }
  }

  return { blob: bestBlob, canvas: workCanvas };
}

async function countPdfPagesForExport(file){
  const ab = await file.arrayBuffer();
  const loadingTask = window.pdfjsLib.getDocument({
    data: ab,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0
  });
  const pdf = await loadingTask.promise;
  try {
    return pdf.numPages || 0;
  } finally {
    try { pdf.cleanup && pdf.cleanup(); } catch(_){}
    try { pdf.destroy && pdf.destroy(); } catch(_){}
  }
}

async function exportPdfToJpg(){
  const pdfs = (picked || []).filter(p => /\.pdf$/i.test(p.file?.name || ''));
  if (!pdfs.length){
    alert('Carica almeno un PDF.');
    return;
  }

  await ensurePdfJs();

  const ZIP_SOFT_LIMIT = 120 * 1024 * 1024;
  const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
  const baseZipName = sanitizeZipName(`EXPORT_PDF2JPG-${stamp}`);
  const pdfInfos = [];

  showEl(ActionProgressWrap);
  setPdf2JpgProgress(0, 100, 'Analisi PDF...');

  try {
    let scanned = 0;
    for (const rec of pdfs){
      const file = rec.file;
      if (ActionProgressLabel) ActionProgressLabel.textContent = `Analisi ${file.name}...`;
      const pages = await countPdfPagesForExport(file);
      pdfInfos.push({ rec, pages });
      scanned += 1;
      setPdf2JpgProgress(scanned, pdfs.length, `Analisi PDF ${scanned}/${pdfs.length}...`);
      await sleep(0);
    }

    const totalPages = pdfInfos.reduce((sum, info) => sum + (info.pages || 0), 0);
    const profile = getPdf2JpgProfile(totalPages);
    let zipPart = 1;
    let zip = new JSZip();
    let zipBytes = 0;
    let zipEntries = 0;
    let convertedPages = 0;

    async function flushCurrentZip(forceLabel){
      if (!zipEntries) return;
      const partName = `${baseZipName}-part${String(zipPart).padStart(2,'0')}.zip`;
      if (ActionProgressLabel) {
        ActionProgressLabel.textContent = forceLabel || `Creo archivio ${zipPart}...`;
      }
      await triggerZipDownload(zip, partName);
      zipPart += 1;
      zip = new JSZip();
      zipBytes = 0;
      zipEntries = 0;
      await sleep(80);
    }

    setPdf2JpgProgress(0, totalPages, `Converto 0/${totalPages} pagine...`);

    for (const info of pdfInfos){
      const rec = info.rec;
      const file = rec.file;
      const relPath = rec.relPath || file.name;
      const relFolder = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '';
      const baseName = file.name.replace(/\.pdf$/i, '');
      const prefixDir = `_EXPORT_PDF2JPG/${relFolder ? relFolder + '/' : ''}`;

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
          setPdf2JpgProgress(convertedPages, totalPages, `Converto ${file.name} pagina ${pageNum}/${pdf.numPages}...`);

          const page = await pdf.getPage(pageNum);
          let canvas = null;

          try {
            const desiredScale = profile.dpi / 72;
            const safeScale = computeSafeScale(page, desiredScale, profile.maxPixels);
            const viewport = page.getViewport({ scale: safeScale });

            canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.ceil(viewport.width));
            canvas.height = Math.max(1, Math.ceil(viewport.height));

            const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;
            let fit = await fitJpegUnderTarget(canvas, profile.targetBytes);
            let blob = fit.blob;

            if (fit.canvas !== canvas){
              canvas.width = 1;
              canvas.height = 1;
              canvas.remove();
              canvas = fit.canvas;
            }

            if (zipEntries > 0 && (zipBytes + blob.size) > ZIP_SOFT_LIMIT){
              await flushCurrentZip(`Archivio ${zipPart} pronto, preparo il successivo...`);
            }

            const suffix = pdf.numPages > 1 ? `-${String(pageNum).padStart(2,'0')}` : '';
            zip.file(`${prefixDir}${baseName}${suffix}.jpg`, blob, { binary: true, compression: 'STORE' });
            zipBytes += blob.size;
            zipEntries += 1;
            convertedPages += 1;
            setPdf2JpgProgress(convertedPages, totalPages, `Convertite ${convertedPages}/${totalPages} pagine - ZIP ${formatBytesPdf2Jpg(zipBytes)}`);
          } finally {
            try { page.cleanup && page.cleanup(); } catch(_){}
            if (canvas){
              canvas.width = 1;
              canvas.height = 1;
              canvas.remove();
            }
          }

          await sleep(0);
        }
      } finally {
        try { pdf.cleanup && pdf.cleanup(); } catch(_){}
        try { pdf.destroy && pdf.destroy(); } catch(_){}
      }
    }

    await flushCurrentZip('Creo ZIP finale...');
    setPdf2JpgProgress(100, 100, zipPart > 2
      ? `Esportazione completata: ${zipPart - 1} archivi ZIP creati.`
      : 'Esportazione completata.');

    setTimeout(() => hideEl(ActionProgressWrap), 1400);
  } catch (err){
    console.error('[PDF2JPG] Export error:', err);
    hideEl(ActionProgressWrap);
    alert('Si e\' verificato un problema durante l\'esportazione PDF to JPG. Riprova con un set piu piccolo oppure verifica il PDF caricato.');
    throw err;
  }
}
