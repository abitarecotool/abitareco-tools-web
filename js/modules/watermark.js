/* ========================= WATERMARK (auto) =========================== */
const DropAreaLogo = $('#DropAreaLogo');
const TxtLogoName  = $('#TxtLogoName');
const BtnClearLogo = $('#BtnClearLogo');
let customLogoFile = null;

if (DropAreaLogo){
  const stop = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  ['dragenter','dragover','dragleave','drop'].forEach(ev => DropAreaLogo.addEventListener(ev, stop));
  DropAreaLogo.addEventListener('dragenter', ()=> DropAreaLogo.classList.add('drag-over'));
  DropAreaLogo.addEventListener('dragleave', ()=> DropAreaLogo.classList.remove('drag-over'));
  DropAreaLogo.addEventListener('drop', (e)=>{
    DropAreaLogo.classList.remove('drag-over');
    const f = e.dataTransfer?.files?.[0]; if (!f) return;
    customLogoFile = f; if (TxtLogoName) TxtLogoName.textContent = f.name; BtnClearLogo?.classList.remove('hidden');
  });
  DropAreaLogo.addEventListener('click', ()=>{
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = ()=>{ const f = inp.files?.[0]; if (!f) return; customLogoFile = f; if (TxtLogoName) TxtLogoName.textContent = f.name; BtnClearLogo?.classList.remove('hidden'); };
    inp.click();
  });
  BtnClearLogo?.addEventListener('click', (e)=>{
    e.stopPropagation(); customLogoFile = null;
    if (TxtLogoName) TxtLogoName.textContent = 'Trascina qui il logo o clicca per sfogliare… (PNG trasparente)';
    BtnClearLogo?.classList.add('hidden');
  });
}
async function loadLogoForWatermark(file){
  if (file) return await createImageBitmap(file, { imageOrientation:'from-image' });
  const candidates = ['./assets/logo-watermark.png','./assets/logo.png'];
  for (const url of candidates){
    try {
      const res = await fetch(url, { cache:'no-store' });
      if (res.ok) return await createImageBitmap(await res.blob(), { imageOrientation:'from-image' });
    } catch {}
  }
  return null;
}
function drawFitToCanvas(bmp, W=1024, H=768, mode='contain'){
  const c = document.createElement('canvas'); c.width=W; c.height=H;
  const ctx = c.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  const sContain = Math.min(W/bmp.width, H/bmp.height);
  const sCover   = Math.max(W/bmp.width, H/bmp.height);
  const scale = (mode === 'cover') ? sCover : sContain;
  const dw = Math.round(bmp.width  * scale);
  const dh = Math.round(bmp.height * scale);
  const dx = Math.round((W - dw)/2);
  const dy = Math.round((H - dh)/2);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality='high';
  ctx.drawImage(bmp, dx, dy, dw, dh);
  return c;
}
function drawLogoCenter(c, logoBmp){
  if (!logoBmp) return;
  const ctx = c.getContext('2d'), W = c.width, H = c.height;
  const maxSide = Math.min(W, H) * 0.35;
  const lr = logoBmp.width / logoBmp.height;
  const lw = lr >= 1 ? maxSide : Math.round(maxSide * lr);
  const lh = lr >= 1 ? Math.round(lw / lr) : maxSide;
  const x = Math.round((W - lw)/2), y = Math.round((H - lh)/2);
  ctx.drawImage(logoBmp, x, y, lw, lh);
}
async function exportWatermarkPortali(){
  const images = picked.filter(p => /\.(jpe?g|png|tif?f|webp)$/i.test(p.file.name));
  const pdfs   = picked.filter(p => /\.pdf$/i.test(p.file.name));
  if (!images.length && !pdfs.length){ alert('Carica immagini o PDF.'); return; }

  const logo = await loadLogoForWatermark(customLogoFile);
  const zip = new JSZip();
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = 'Elaborazione…';
  const total = images.length + pdfs.length; let done = 0;

  // IMMAGINI → cover
  let counterImg = 0;
  for (const rec of images){
    const bmp = await loadImageBitmap(rec.file);
    const c = drawFitToCanvas(bmp, 1024, 768, 'cover');
    drawLogoCenter(c, logo);
    const jpg = await canvasToBlob(c,'image/jpeg',0.92);
    const nn = String(++counterImg).padStart(2,'0');
    zip.file(`_EXPORT_WATERMARK/immagini/immagini-${nn}.jpg`, jpg);
    ActionProgress.value = Math.round((++done/total)*100);
  }

  // PDF (A3) → contain
  if (pdfs.length){
    await ensurePdfJs();
    for (const rec of pdfs){
      const ab = await rec.file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({data:ab}).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 300/72 });
      const tmp = document.createElement('canvas');
      tmp.width  = Math.ceil(viewport.width);
      tmp.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: tmp.getContext('2d'), viewport }).promise;
      const bmp = await createImageBitmap(tmp);
      const c = drawFitToCanvas(bmp, 1024, 768, 'contain');
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
  a.download = `EXPORT_WATERMARK-${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
  hideEl(ActionProgressWrap);
}

