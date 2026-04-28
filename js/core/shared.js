/* ===== Core shared utilities (extracted) ===== */
async function readDroppedDirectory(dt){
  const items = Array.from(dt.items || []);
  const out = [];

  async function traverse(entry, base=''){
    if (entry.isFile){
      const f = await new Promise(res => entry.file(res));
      if (/\.(jpe?g|png|webp|tif?f|pdf)$/i.test(f.name)){
        out.push({ file:f, relPath: base ? `${base}/${f.name}` : f.name });
      }
    } else if (entry.isDirectory){
      const reader = entry.createReader();
      const entries = [];
      // readEntries restituisce al massimo ~100 elementi per chiamata: loop finché vuoto
      while (true){
        const batch = await new Promise(res => reader.readEntries(res));
        if (!batch || batch.length === 0) break;
        entries.push(...batch);
      }
      for (const en of entries){
        await traverse(en, base ? `${base}/${entry.name}` : entry.name);
      }
    }
  }

  for (const it of items){
    const en = it.webkitGetAsEntry?.();
    if (en) await traverse(en);
  }
  return out;
}

function slugify(t){
  if (!t) return '';
  return t.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[’'`]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

async function loadImageBitmap(file){
  const url = URL.createObjectURL(file);
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { imageOrientation:'from-image' });
  URL.revokeObjectURL(url);
  return bmp;
}

function canvasToBlob(canvas, mime, q=0.85){ return new Promise(res => canvas.toBlob(res, mime, q)); }

/* =============================== Immagini (Sito) ====================== */

/* --------- CROP MANUALE (SOLO SE 1 IMMAGINE) --------- */

// elementi DOM (init sicuro)
const ImageCropCard = document.getElementById('ImageCropCard');
const CropFrame     = document.getElementById('CropFrame');
const CropImg       = document.getElementById('CropImg');
const CropReset     = document.getElementById('CropReset');
const CropZoom      = document.getElementById('CropZoom');

// stato crop (pan + zoom)
let crop = {
  x: 0,
  y: 0,
  scale: 1,
  minScale: 0.01,
  maxScale: 4,
  coverScale: 1,
  containScale: 1,
  dragging: false,
  startX: 0,
  startY: 0,
  pointerId: null
};

function clamp(v, a, b){ return Math.min(b, Math.max(a, v)); }

function updateZoomTrack(){
  if (!CropZoom) return;
  const min = Number(CropZoom.min) || 0;
  const max = Number(CropZoom.max) || 1;
  const val = Number(CropZoom.value) || min;
  const pct = (max > min) ? ((val - min) / (max - min)) * 100 : 0;
  CropZoom.style.setProperty('--fill', pct + '%');
}
