/* ============================== DigitalTool =========================== */
function makeCanvasFromRules(bmp){
  const w=bmp.width, h=bmp.height, ratio=w/h;
  const square = Math.abs(ratio-1) <= 0.03;
  if (square){
    const W=2000, H=2000;
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    const scale=Math.max(W/w, H/h);
    const dw=Math.round(w*scale), dh=Math.round(h*scale);
    const dx=Math.round((W-dw)/2), dy=Math.round((H-dh)/2);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(bmp, dx, dy, dw, dh);
    return c;
  }
  if (w>=h){
    const W=2500; const H=Math.round(h*(W/w));
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(bmp,0,0,W,H);
    return c;
  }
  {
    const H=2000; const W=Math.round(w*(H/h));
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(bmp,0,0,W,H);
    return c;
  }
}
async function toBlobCapped(canvas, mime){
  const ladder=[0.85,0.75,0.65,0.50,0.40];
  for (const q of ladder){
    const b = await new Promise(res=>canvas.toBlob(res,mime,q));
    if (!b) continue;
    if (b.size <= 450*1024) return b;
    if (q===ladder[ladder.length-1]) return b;
  }
}
async function exportDigitalTool(){
  const images = picked.filter(p => /\.(jpe?g|png|tif?f)$/i.test(p.file.name));
  if (!images.length){ alert("Carica immagini."); return; }
  const files = images.sort((a,b)=> (a.relPath || a.file.name).localeCompare(b.relPath || b.file.name, undefined, { numeric:true }));
  const zip = new JSZip();
  showEl(ActionProgressWrap); ActionProgress.value = 0; ActionProgressLabel.textContent = "Esportazione in corso…";
  const countsByFolder = new Map();
  const total = files.length; let processed = 0;
  for (const rec of files){
    const p = rec.relPath || rec.file.name;
    const relFolder = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
    const current = countsByFolder.get(relFolder) || 0;
    const nn = String(current+1).padStart(2,'0');
    countsByFolder.set(relFolder, current+1);
    const basePathWEBP = `_DIGITALTOOL/${relFolder ? relFolder + '/' : ''}WEBP/`;
    const basePathJPG  = `_DIGITALTOOL/${relFolder ? relFolder + '/' : ''}JPG/`;
    const bmp = await loadImageBitmap(rec.file);
    const canvas = makeCanvasFromRules(bmp);
    const webp = await toBlobCapped(canvas,'image/webp');
    const jpg  = await toBlobCapped(canvas,'image/jpeg');
    if (webp) zip.file(`${basePathWEBP}${nn}.webp`, webp);
    if (jpg)  zip.file(`${basePathJPG}${nn}.jpg`,  jpg);
    ActionProgress.value = Math.round((++processed/total)*100);
  }
  const stamp = new Date().toISOString().replace(/[:\-T]/g,'').slice(0,15);
  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `DIGITALTOOL-${stamp}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
  hideEl(ActionProgressWrap);
}

