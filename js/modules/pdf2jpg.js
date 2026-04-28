/* ============================== PDF → JPG ============================= */
async function ensurePdfJs(){
  if (window.pdfjsLib) return;
  await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload=resolve; s.onerror=reject;
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}
async function exportPdfToJpg(){
  const pdfs = picked.filter(p => /\.pdf$/i.test(p.file.name));
  if (!pdfs.length){ alert("Carica PDF."); return; }
  await ensurePdfJs();
  const zip = new JSZip();
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = "Esportazione in corso…";
  const TARGET = 1.5 * 1024 * 1024;
  const total = pdfs.length; let processed = 0;
  for (const rec of pdfs){
    const file = rec.file;
    const relPath = rec.relPath || rec.file.name;
    const relFolder = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '';
    const baseName  = file.name.replace(/\.pdf$/i,'');
    const prefixDir = `_EXPORT_PDF2JPG/${relFolder ? relFolder + '/' : ''}`;
    const ab = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({data:ab}).promise;
    for (let pageNum=1; pageNum<=pdf.numPages; pageNum++){
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale:300/72 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext:ctx, viewport }).promise;
      let blob = await canvasToBlob(canvas, 'image/jpeg', 0.95);
      if (blob.size > TARGET){
        const ladder=[0.90,0.85,0.80,0.75];
        for (const q of ladder){
          const b = await canvasToBlob(canvas,'image/jpeg',q);
          blob = b; if (b.size <= TARGET) break;
        }
      }
      const suffix = pdf.numPages>1 ? `-${String(pageNum).padStart(2,'0')}` : '';
      zip.file(`${prefixDir}${baseName}${suffix}.jpg`, blob);
    }
    ActionProgress.value = Math.round((++processed/total)*100);
  }
  const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `EXPORT_PDF2JPG-${stamp}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
  hideEl(ActionProgressWrap);
}

